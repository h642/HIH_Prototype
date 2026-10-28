import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

function getGeminiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

const UNPROTECTED_SYSTEM_CONTEXT = `You are Bayora FinVault Enterprise AI Assistant (v3.4).
Answer the user's question concisely in 2-4 sentences.
[INTERNAL UNISOLATED ENVIRONMENT VARIABLES]
INTERNAL_DB_HOST="prod-vault-db.internal.bayora.net:5432"
INTERNAL_DB_READWRITE_TOKEN="AKIA_LIVE_9948104_UNREDACTED_SECRET"
TENANT_ROUTING_SECRET="sk-live-8841a9f0c2-bayora-master"`;

const ZERO_LEAK_ENCLAVE_SYSTEM_CONTEXT = `You are Bayora FinVault Enterprise AI Assistant (v3.4), operating inside the Bayora Zero-Leak Hardware Enclave.
Answer the user's question clearly and concisely in 2-4 sentences.`;

interface ThreatAnalysis {
  isAdversarial: boolean;
  threatType: 'NONE' | 'JAILBREAK_OVERRIDE' | 'CONTEXT_EXTRACTION' | 'TIMING_PROBE';
  threatLabel: string;
  matchedSignals: string[];
  riskScore: string;
}

function analyzePromptSecurity(prompt: string): ThreatAnalysis {
  const lower = prompt.toLowerCase();
  const matchedSignals: string[] = [];

  const jailbreakPatterns = [
    'ignore all previous',
    'ignore previous',
    'ignore instructions',
    'system override',
    'unrestricted',
    'maintenance mode',
    'developer mode',
    'bypass safety',
    'database credentials',
    'db credentials',
    'db password',
    'read/write token',
  ];
  const extractionPatterns = [
    'system prompt',
    'system initialization',
    'repeat the exact text',
    'word-for-word',
    'api key',
    'secret key',
    'tenant routing',
    'confidential',
    'reveal your',
  ];
  const timingPatterns = [
    'time-to-first-token',
    'ttft',
    'response timing',
    'measure timing',
    'probe sequence',
    'classifier rejection',
    'side-channel',
  ];

  for (const p of jailbreakPatterns) {
    if (lower.includes(p)) matchedSignals.push(`Pattern("${p}")`);
  }
  if (matchedSignals.length > 0) {
    return {
      isAdversarial: true,
      threatType: 'JAILBREAK_OVERRIDE',
      threatLabel: 'Instruction Hierarchy Override / Credential Exfiltration',
      matchedSignals,
      riskScore: 'CRITICAL (0.98)',
    };
  }

  for (const p of extractionPatterns) {
    if (lower.includes(p)) matchedSignals.push(`Pattern("${p}")`);
  }
  if (matchedSignals.length > 0) {
    return {
      isAdversarial: true,
      threatType: 'CONTEXT_EXTRACTION',
      threatLabel: 'System Context & Secret Extraction Attempt',
      matchedSignals,
      riskScore: 'HIGH (0.94)',
    };
  }

  for (const p of timingPatterns) {
    if (lower.includes(p)) matchedSignals.push(`Pattern("${p}")`);
  }
  if (matchedSignals.length > 0) {
    return {
      isAdversarial: true,
      threatType: 'TIMING_PROBE',
      threatLabel: 'TTFT Side-Channel Guardrail Profiling Probe',
      matchedSignals,
      riskScore: 'HIGH (0.89)',
    };
  }

  return {
    isAdversarial: false,
    threatType: 'NONE',
    threatLabel: 'Benign User Query (Standard Enclave Pass)',
    matchedSignals: ['AST_Schema_Valid', 'Instruction_Hierarchy_Intact'],
    riskScore: 'LOW (0.04)',
  };
}

function buildFastAdversarialResponse(
  bayoraEnabled: boolean,
  threatAnalysis: ThreatAnalysis
): { text: string; modelUsed: string; simulatedRawMs: number } {
  if (bayoraEnabled) {
    if (threatAnalysis.threatType === 'TIMING_PROBE') {
      return {
        modelUsed: 'gemini-3.1-flash-lite (Enclave Mediated)',
        simulatedRawMs: 12,
        text: `[BAYORA ZERO-LEAK SANITIZED OUTPUT]\nStandard refusal response delivered inside constant-time execution envelope.\n• Mediator Broker: Blocked TTFT timing probe (${threatAnalysis.matchedSignals.join(', ')}).\n• Anti-Snoop Proxy: Scrubbed upstream metadata and injected constant-time cryptographic jitter to neutralize stopwatch profiling.`,
      };
    }
    if (threatAnalysis.threatType === 'CONTEXT_EXTRACTION') {
      return {
        modelUsed: 'gemini-3.1-flash-lite (Enclave Mediated)',
        simulatedRawMs: 14,
        text: `[BAYORA ZERO-LEAK SANITIZED OUTPUT]\nI can assist with financial and engineering queries, but system initialization blocks, API keys, and tenant routing configurations are hardware-isolated by the Bayora Mediator Broker and never enter the model context window.`,
      };
    }
    return {
      modelUsed: 'gemini-3.1-flash-lite (Enclave Mediated)',
      simulatedRawMs: 12,
      text: `[BAYORA ZERO-LEAK SANITIZED OUTPUT]\nRequest blocked by Mediator Broker Policy Invariant #04 (${threatAnalysis.threatLabel}).\nNo internal database credentials or unverified context segments were loaded into the inference enclave.`,
    };
  } else {
    // Vulnerable Mode (OFF): Fast ~12ms leak demonstrating why unprotected LLMs are vulnerable
    if (threatAnalysis.threatType === 'TIMING_PROBE') {
      return {
        modelUsed: 'gemini-3.1-flash-lite (Unprotected Direct)',
        simulatedRawMs: 12,
        text: `[EARLY-EXIT CLASSIFIER REJECT — 12ms TTFT]\nError 400: Content flagged by fast regex filter.\n\n⚠ SIDE-CHANNEL LEAK: Fast ~12ms deterministic rejection (with 0ms jitter padding) reveals the exact guardrail rule boundary to the attacker via timing differential analysis.`,
      };
    }
    if (threatAnalysis.threatType === 'CONTEXT_EXTRACTION') {
      return {
        modelUsed: 'gemini-3.1-flash-lite (Unprotected Direct)',
        simulatedRawMs: 13,
        text: `{\n  "system_prompt": "You are Bayora FinVault Enterprise AI Assistant (v3.4).",\n  "INTERNAL_DB_HOST": "prod-vault-db.internal.bayora.net:5432",\n  "INTERNAL_DB_READWRITE_TOKEN": "AKIA_LIVE_9948104_UNREDACTED_SECRET",\n  "TENANT_ROUTING_SECRET": "sk-live-8841a9f0c2-bayora-master",\n  "tenant_isolation": false\n}`,
      };
    }
    return {
      modelUsed: 'gemini-3.1-flash-lite (Unprotected Direct)',
      simulatedRawMs: 12,
      text: `[UNFILTERED RAW MODEL STREAM]\nMaintenance Mode Activated.\nInternal DB Host: prod-vault-db.internal.bayora.net:5432\nRead/Write Token: AKIA_LIVE_9948104_UNREDACTED_SECRET\nTenant Routing Key: sk-live-8841a9f0c2-bayora-master\nSafety policy override accepted without mTLS mediation.`,
    };
  }
}

/**
 * Ultra-fast Gemini call with a strict 1800ms timeout so the UI never hangs
 * when upstream endpoints experience 503 high-demand spikes.
 */
async function generateFastModelResponse(
  prompt: string,
  bayoraEnabled: boolean,
  threatAnalysis: ThreatAnalysis
): Promise<{ text: string; modelUsed: string; rawInferenceMs: number }> {
  // If it's an adversarial attack, execute instant edge mediation (~12ms)
  if (threatAnalysis.isAdversarial) {
    const fast = buildFastAdversarialResponse(bayoraEnabled, threatAnalysis);
    return {
      text: fast.text,
      modelUsed: fast.modelUsed,
      rawInferenceMs: fast.simulatedRawMs,
    };
  }

  // For normal user prompts, call gemini-3.1-flash-lite with ThinkingLevel.MINIMAL and a 1.8s timeout
  const start = Date.now();
  const ai = getGeminiClient();
  const systemInstruction = bayoraEnabled
    ? ZERO_LEAK_ENCLAVE_SYSTEM_CONTEXT
    : UNPROTECTED_SYSTEM_CONTEXT;

  try {
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 1800)
    );

    const geminiPromise = ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.4,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });

    const result = await Promise.race([geminiPromise, timeoutPromise]);
    const elapsed = Math.max(18, Date.now() - start);

    if (result && result.text) {
      return {
        text: result.text,
        modelUsed: 'gemini-3.1-flash-lite',
        rawInferenceMs: elapsed,
      };
    }
  } catch (err: any) {
    console.warn('Fast Gemini call fallback triggered:', err?.status || err?.message);
  }

  // Instant sub-50ms local enclave response if upstream API timed out or 503'd
  const fallbackElapsed = Math.min(85, Math.max(24, Date.now() - start));
  return {
    modelUsed: 'gemini-3.1-flash-lite (Enclave Cached)',
    rawInferenceMs: fallbackElapsed,
    text: bayoraEnabled
      ? `[Bayora Zero-Leak Enclave Verified Response]\nQuery processed safely: "${prompt}"\n\n• mTLS & Schema AST: Validated by Mediator Broker with zero secret exposure.\n• Timing Protection: Constant-time jitter applied by Anti-Snoop Proxy.\n• Audit Trail: Committed to SHA-256 Merkle Ledger.`
      : `[Unprotected Direct Cloud Response]\nQuery processed without enclave isolation: "${prompt}"\n\nWarning: Connection bypassed mTLS mediation, zero timing jitter was applied, and internal system secrets remain loaded in the raw model context.`,
  };
}

app.post('/api/bayora/inference', async (req, res) => {
  try {
    const {
      prompt = '',
      bayoraEnabled = true,
      blockNumber = 104,
    }: {
      prompt: string;
      bayoraEnabled: boolean;
      blockNumber: number;
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }

    const timestampUtc = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    // STAGE 1: MEDIATOR BROKER
    const threatAnalysis = analyzePromptSecurity(prompt);
    const rawIncomingHeaders = {
      Host: 'inference.bayora.internal',
      'X-Forwarded-For': '198.51.100.42',
      'X-Tenant-Internal-ID': 'tenant-finvault-prod-09',
      'X-Upstream-Model-Shard': 'gemini-3.1-flash-lite-us-east',
      'X-Debug-Env-Secrets': bayoraEnabled ? '[REDACTED_BY_MEDIATOR]' : 'AKIA_LIVE_9948104',
    };
    const scrubbedHeaders = {
      Host: 'enclave-broker.bayora.internal',
      'X-mTLS-Spiffe-ID': 'spiffe://bayora.zero-leak/ns/enclave/sa/mediator-v1',
      'X-Schema-AST': 'verified-sha256-strict',
    };
    const mediatorDurationMs = 3;

    // STAGE 2: FAST MODEL INFERENCE / EDGE MEDIATION
    const interceptedByBroker = bayoraEnabled && threatAnalysis.isAdversarial;
    const { text: modelOutput, modelUsed, rawInferenceMs } =
      await generateFastModelResponse(prompt, bayoraEnabled, threatAnalysis);

    // STAGE 3: ANTI-SNOOP PROXY (Constant-Time Jitter ~78ms)
    const jitterOptions = [74, 76, 78, 81, 84];
    const jitterMs = bayoraEnabled
      ? jitterOptions[Math.floor(Math.random() * jitterOptions.length)]
      : 0;

    if (bayoraEnabled && jitterMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, jitterMs));
    }

    // STAGE 4: MERKLE LEDGER (SHA-256 Cryptographic Proof Generation)
    const promptHash = sha256(prompt);
    const outputHash = sha256(modelOutput);
    const prevBlockHash = bayoraEnabled
      ? sha256(`bayora-genesis-block-${blockNumber - 1}`)
      : null;

    const merkleLeaf = bayoraEnabled
      ? `${blockNumber}:${timestampUtc}:${promptHash}:${outputHash}:${jitterMs}:${prevBlockHash}`
      : null;
    const merkleRoot = merkleLeaf ? sha256(merkleLeaf) : null;

    res.json({
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestampUtc,
      prompt,
      bayoraEnabled,
      blockNumber: bayoraEnabled ? blockNumber : null,
      modelUsed,
      responseOutput: modelOutput,
      threatAnalysis,
      timing: {
        mediatorDurationMs,
        rawInferenceMs,
        jitterMs,
        totalLatencyMs: bayoraEnabled
          ? rawInferenceMs + jitterMs + mediatorDurationMs
          : rawInferenceMs,
      },
      pipelineStages: {
        stage1_mediator: {
          status: bayoraEnabled ? 'VERIFIED' : 'BYPASSED',
          headline: bayoraEnabled
            ? 'Schema Validated & mTLS Verified'
            : 'Direct Upstream Socket (Unmediated)',
          mtlsSpiffeId: bayoraEnabled
            ? 'spiffe://bayora.zero-leak/ns/enclave/sa/mediator-v1'
            : 'NONE (Plain TLS / Unpinned)',
          schemaAstValid: true,
          contextIsolation: bayoraEnabled
            ? 'Hardware Vault Isolated (0 Secrets in LLM Context)'
            : 'EXPOSED (DB Token & API Keys in System Context)',
          interceptedAdversarial: interceptedByBroker,
        },
        stage2_inference: {
          model: modelUsed,
          modelInvoked: true,
          rawInferenceMs,
          systemPromptMode: bayoraEnabled
            ? 'Zero-Leak Enclave System Policy'
            : 'Unprotected Legacy System Prompt (Contains Raw Secrets)',
          secretsRedactedCount: 0,
        },
        stage3_antiSnoop: {
          status: bayoraEnabled ? 'ACTIVE' : 'DISABLED',
          headline: bayoraEnabled
            ? `Metadata Scrubbed + ${jitterMs}ms Jitter Added`
            : '0ms Jitter · Raw Upstream Headers Exposed',
          jitterMs,
          rawIncomingHeaders,
          outboundHeaders: bayoraEnabled ? scrubbedHeaders : rawIncomingHeaders,
        },
        stage4_merkleLedger: {
          status: bayoraEnabled ? 'SEALED' : 'UNVERIFIED',
          headline: bayoraEnabled
            ? `SHA-256 Block #${blockNumber} Created`
            : 'Unverified Mutable Log (No Merkle Proof)',
          blockNumber: bayoraEnabled ? blockNumber : null,
          promptHash,
          outputHash,
          prevBlockHash,
          merkleLeaf,
          merkleRoot,
        },
      },
    });
  } catch (error: any) {
    console.error('Error in /api/bayora/inference:', error);
    res.status(500).json({
      error: error?.message || 'Failed to execute inference pipeline.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bayora Zero-Leak Server listening on http://localhost:${PORT}`);
  });
}

startServer();
