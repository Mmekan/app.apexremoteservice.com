import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, email, firstName, dashboardUrl } = await req.json();

    const client = new SmtpClient();
    await client.connectTLS({
      hostname: Deno.env.get("SMTP_HOST")!,
      port: Number(Deno.env.get("SMTP_PORT")!),
      username: Deno.env.get("SMTP_USER")!,
      password: Deno.env.get("SMTP_PASS")!,
    });

    const fromEmail = Deno.env.get("SMTP_FROM")!;
    const fromName  = "Apex Remote Services";

    let subject = "";
    let html    = "";

    if (type === "approved") {
      subject = "🎉 Your application has been approved — Apex Remote Services";
      html = `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#F4F7FE;font-family:'Inter',sans-serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            <div style="background:linear-gradient(135deg,#14183E,#1363C6);padding:36px 40px;text-align:center;">
              <h1 style="color:#fff;font-size:26px;margin:0;letter-spacing:-0.5px;">
                Apex<span style="color:#15ACE1;">.</span>rs
              </h1>
            </div>
            <div style="padding:40px;">
              <h2 style="color:#14183E;font-size:22px;margin:0 0 12px;">
                Congratulations, ${firstName}! 🎉
              </h2>
              <p style="color:#5a6278;font-size:15px;line-height:1.7;margin:0 0 24px;">
                We're thrilled to let you know that your application to 
                <strong>Apex Remote Services</strong> has been 
                <strong style="color:#16a34a;">approved</strong>.
              </p>
              <p style="color:#5a6278;font-size:15px;line-height:1.7;margin:0 0 32px;">
                You're now part of our network. Log in to your dashboard to see 
                your updated status and next steps.
              </p>
              <div style="text-align:center;">
                <a href="${dashboardUrl}" 
                   style="display:inline-block;background:linear-gradient(135deg,#1363C6,#15ACE1);
                          color:#fff;text-decoration:none;padding:14px 36px;
                          border-radius:12px;font-weight:600;font-size:15px;">
                  Go to My Dashboard
                </a>
              </div>
            </div>
            <div style="padding:20px 40px;background:#f8faff;text-align:center;
                        font-size:12px;color:#a0aec0;border-top:1px solid #eef0f6;">
              © 2026 Apex Remote Services. All rights reserved.
            </div>
          </div>
        </body>
        </html>`;

    } else if (type === "rejected") {
      subject = "Your application status — Apex Remote Services";
      html = `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#F4F7FE;font-family:'Inter',sans-serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            <div style="background:linear-gradient(135deg,#14183E,#1363C6);padding:36px 40px;text-align:center;">
              <h1 style="color:#fff;font-size:26px;margin:0;letter-spacing:-0.5px;">
                Apex<span style="color:#15ACE1;">.</span>rs
              </h1>
            </div>
            <div style="padding:40px;">
              <h2 style="color:#14183E;font-size:22px;margin:0 0 12px;">
                Application Update, ${firstName}
              </h2>
              <p style="color:#5a6278;font-size:15px;line-height:1.7;margin:0 0 20px;">
                Thank you for applying to Apex Remote Services. After careful review, 
                we're unable to approve your application at this time.
              </p>
              <div style="background:#fff8f0;border-left:4px solid #f97316;
                          border-radius:8px;padding:16px 20px;margin:0 0 24px;">
                <p style="color:#7c4a03;font-size:14px;line-height:1.7;margin:0;font-weight:500;">
                  ⏱ You have <strong>72 hours</strong> to review and resubmit your application. 
                  Please note that you have a <strong>limited number of revisions</strong>, 
                  so review each section carefully before resubmitting.
                </p>
              </div>
              <p style="color:#5a6278;font-size:15px;line-height:1.7;margin:0 0 32px;">
                Log in to your dashboard to update your information and resubmit.
              </p>
              <div style="text-align:center;">
                <a href="${dashboardUrl}"
                   style="display:inline-block;background:linear-gradient(135deg,#1363C6,#15ACE1);
                          color:#fff;text-decoration:none;padding:14px 36px;
                          border-radius:12px;font-weight:600;font-size:15px;">
                  Review My Application
                </a>
              </div>
            </div>
            <div style="padding:20px 40px;background:#f8faff;text-align:center;
                        font-size:12px;color:#a0aec0;border-top:1px solid #eef0f6;">
              © 2026 Apex Remote Services. All rights reserved.
            </div>
          </div>
        </body>
        </html>`;
    }

    await client.send({
      from:    `${fromName} <${fromEmail}>`,
      to:      email,
      subject,
      html,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});