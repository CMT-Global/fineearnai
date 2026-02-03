import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface EmailOptions {
  templateType: string;
  recipientEmail: string;
  recipientUserId?: string;
  variables: Record<string, any>;
  supabaseClient?: any;
}

/**
 * Helper to send templated emails via the send-template-email edge function
 */
export async function sendTemplateEmail(options: EmailOptions) {
  const { templateType, recipientEmail, recipientUserId, variables, supabaseClient } = options;
  
  console.log(`📧 [Email Sender] Starting email send process for ${recipientEmail} (type: ${templateType})`);
  
  try {
    const supabase = supabaseClient || createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call the send-template-email edge function
    const { data, error } = await supabase.functions.invoke('send-template-email', {
      body: {
        email: recipientEmail,
        template_type: templateType,
        variables: {
          ...variables,
          recipient_user_id: recipientUserId
        }
      }
    });

    if (error) {
      console.error(`❌ [Email Sender] Edge function invocation error:`, error);
      return { success: false, error: error.message };
    }

    if (data?.success === false) {
      console.error(`❌ [Email Sender] Edge function returned error:`, data.error);
      return { success: false, error: data.error };
    }

    console.log(`✅ [Email Sender] Email sent successfully! Resend ID: ${data?.email_id || data?.resend_id || 'unknown'}`);
    return { success: true, data };
  } catch (error) {
    console.error(`❌ [Email Sender] Unexpected error:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
