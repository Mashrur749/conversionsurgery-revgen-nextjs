/**
 * API Cost Configuration
 * All costs in dollars per unit
 * Updated: February 2026
 */

export const API_COSTS = {
  // OpenAI - per 1K tokens
  openai: {
    'gpt-4o-mini': {
      input: 0.00015,  // $0.15 per 1M
      output: 0.0006,  // $0.60 per 1M
    },
    'gpt-4o': {
      input: 0.0025,   // $2.50 per 1M
      output: 0.01,    // $10 per 1M
    },
    'gpt-4-turbo': {
      input: 0.01,
      output: 0.03,
    },
    'gpt-4-turbo-preview': {
      input: 0.01,
      output: 0.03,
    },
  },

  // Twilio SMS - per segment (US)
  twilio_sms: {
    outbound: 0.0079,
    inbound: 0.0079,
    mms_outbound: 0.02,
    mms_inbound: 0.01,
  },

  // Twilio Voice - per minute (US)
  twilio_voice: {
    outbound: 0.014,
    inbound: 0.0085,
    recording: 0.0025, // per minute stored
  },

  // Twilio Phone Numbers - per month
  twilio_phone: {
    local: 1.15,
    toll_free: 2.15,
  },

  // Stripe - percentage + fixed
  stripe: {
    percentage: 0.029,  // 2.9%
    fixed: 0.30,        // $0.30 per transaction
  },

  // Google Places API - per request
  google_places: {
    place_details: 0.017,
    find_place: 0.017,
    nearby_search: 0.032,
  },

  // Cloudflare R2 - per GB
  cloudflare_r2: {
    storage_gb: 0.015,  // per month
    class_a_ops: 0.0000045, // per 1K (PUT, POST, LIST)
    class_b_ops: 0.00000036, // per 1K (GET)
  },
} as const;

export type ApiService = keyof typeof API_COSTS;

/**
 * Calculate cost in cents for a given API call
 */
export function calculateCostCents(params: {
  service: ApiService;
  operation: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  units?: number;
  amount?: number; // For Stripe transactions
}): number {
  const { service, operation, model, inputTokens, outputTokens, units = 1, amount } = params;

  let costDollars = 0;

  switch (service) {
    case 'openai': {
      const modelKey = model || 'gpt-4o-mini';
      const modelCosts = API_COSTS.openai[modelKey as keyof typeof API_COSTS.openai];
      if (modelCosts) {
        const inputCost = ((inputTokens || 0) / 1000) * modelCosts.input;
        const outputCost = ((outputTokens || 0) / 1000) * modelCosts.output;
        costDollars = inputCost + outputCost;
      }
      break;
    }

    case 'twilio_sms': {
      const smsCosts = API_COSTS.twilio_sms;
      const rate = smsCosts[operation as keyof typeof smsCosts] || smsCosts.outbound;
      costDollars = rate * units;
      break;
    }

    case 'twilio_voice': {
      const voiceCosts = API_COSTS.twilio_voice;
      const rate = voiceCosts[operation as keyof typeof voiceCosts] || voiceCosts.outbound;
      costDollars = rate * units;
      break;
    }

    case 'twilio_phone': {
      const phoneCosts = API_COSTS.twilio_phone;
      const rate = phoneCosts[operation as keyof typeof phoneCosts] || phoneCosts.local;
      costDollars = rate * units;
      break;
    }

    case 'stripe': {
      if (amount) {
        costDollars = (amount * API_COSTS.stripe.percentage) + API_COSTS.stripe.fixed;
      }
      break;
    }

    case 'google_places': {
      const placesCosts = API_COSTS.google_places;
      const rate = placesCosts[operation as keyof typeof placesCosts] || placesCosts.place_details;
      costDollars = rate * units;
      break;
    }

    case 'cloudflare_r2': {
      const r2Costs = API_COSTS.cloudflare_r2;
      const rate = r2Costs[operation as keyof typeof r2Costs] || r2Costs.storage_gb;
      costDollars = rate * units;
      break;
    }
  }

  // Convert to cents and round
  return Math.round(costDollars * 100);
}
