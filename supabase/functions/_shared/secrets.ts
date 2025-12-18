/**
 * Centralized Secrets Management Utility
 * 
 * Fetches API keys and credentials from platform_config table
 * with fallback to Deno environment variables.
 */

export interface SystemSecrets {
  geminiApiKey: string | null;
  cpay: {
    walletId: string | null;
    publicKey: string | null;
    privateKey: string | null;
    passphrase: string | null;
    usdtTokenId: string | null;
  };
  resendApiKey: string | null;
  ipstackApiKey: string | null;
  openExchangeAppId: string | null;
}

/**
 * Fetches all system secrets with fallbacks
 * @param supabaseClient - Supabase client with service role
 */
export async function getSystemSecrets(supabaseClient: any): Promise<SystemSecrets> {
  try {
    const { data: configData } = await supabaseClient
      .from('platform_config')
      .select('key, value')
      .in('key', [
        'gemini_config',
        'cpay_config',
        'resend_config',
        'ipstack_api_key', // Legacy key name
        'openexchange_config'
      ]);

    const configMap: Record<string, any> = {};
    configData?.forEach((row: any) => {
      configMap[row.key] = row.value;
    });

    return {
      // Gemini API Key
      geminiApiKey: 
        configMap.gemini_config?.apiKey || 
        // @ts-ignore
        Deno.env.get('GEMINI_API_KEY') || 
        // @ts-ignore
        Deno.env.get('LOVABLE_API_KEY'),

      // CPAY Credentials
      cpay: {
        walletId: 
          configMap.cpay_config?.walletId || 
          // @ts-ignore
          Deno.env.get('CPAY_WALLET_ID'),
        publicKey: 
          configMap.cpay_config?.publicKey || 
          // @ts-ignore
          Deno.env.get('CPAY_API_PUBLIC_KEY'),
        privateKey: 
          configMap.cpay_config?.privateKey || 
          // @ts-ignore
          Deno.env.get('CPAY_API_PRIVATE_KEY'),
        passphrase: 
          configMap.cpay_config?.passphrase || 
          // @ts-ignore
          Deno.env.get('CPAY_WALLET_PASSPHRASE'),
        usdtTokenId: 
          configMap.cpay_config?.usdtTokenId || 
          // @ts-ignore
          Deno.env.get('CPAY_USDT_TOKEN_ID'),
      },

      // Resend API Key
      resendApiKey: 
        configMap.resend_config?.apiKey || 
        // @ts-ignore
        Deno.env.get('RESEND_API_KEY'),

      // IPStack API Key
      ipstackApiKey: 
        configMap.ipstack_api_key || 
        // @ts-ignore
        Deno.env.get('IPSTACK_API_KEY'),

      // OpenExchangeRates App ID
      openExchangeAppId: 
        configMap.openexchange_config?.appId || 
        // @ts-ignore
        Deno.env.get('OPENEXCHANGERATES_APP_ID'),
    };
  } catch (error) {
    console.error('❌ Failed to load secrets from database, using environment variables only:', error);
    return {
      // @ts-ignore
      geminiApiKey: Deno.env.get('GEMINI_API_KEY') || Deno.env.get('LOVABLE_API_KEY'),
      cpay: {
        // @ts-ignore
        walletId: Deno.env.get('CPAY_WALLET_ID'),
        // @ts-ignore
        publicKey: Deno.env.get('CPAY_API_PUBLIC_KEY'),
        // @ts-ignore
        privateKey: Deno.env.get('CPAY_API_PRIVATE_KEY'),
        // @ts-ignore
        passphrase: Deno.env.get('CPAY_WALLET_PASSPHRASE'),
        // @ts-ignore
        usdtTokenId: Deno.env.get('CPAY_USDT_TOKEN_ID'),
      },
      // @ts-ignore
      resendApiKey: Deno.env.get('RESEND_API_KEY'),
      // @ts-ignore
      ipstackApiKey: Deno.env.get('IPSTACK_API_KEY'),
      // @ts-ignore
      openExchangeAppId: Deno.env.get('OPENEXCHANGERATES_APP_ID'),
    };
  }
}
