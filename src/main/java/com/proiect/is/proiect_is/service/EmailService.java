package com.proiect.is.proiect_is.service;

import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:proiect.is19@gmail.com}")
    private String senderEmail;

    /**
     * Trimite email automat de invitație profesional (stil Google Meet) de pe contul oficial proiect.is19@gmail.com.
     */
    public boolean sendMeetingInvitation(
            List<String> toEmails,
            String eventTitle,
            String eventDate,
            String startTime,
            String meetLink,
            String senderName,
            String description) {

        if (toEmails == null || toEmails.isEmpty()) {
            return false;
        }

        String safeTitle = (eventTitle != null && !eventTitle.isBlank()) ? eventTitle.trim() : "Ședință de lucru";
        String safeSender = (senderName != null && !senderName.isBlank()) ? senderName.trim() : "Echipa Workspace";
        String safeMeet = (meetLink != null && !meetLink.isBlank()) ? meetLink.trim() : "https://meet.google.com/new";
        String safeTime = (startTime != null && !startTime.isBlank()) ? startTime.trim() : "";
        String safeDate = (eventDate != null && !eventDate.isBlank()) ? eventDate.trim() : "";
        String safeDesc = (description != null && !description.isBlank()) ? description.trim() : "";

        // Subiect curat în format standard Google Calendar
        String subject = "Invitație: " + safeTitle + (safeDate.isEmpty() ? "" : " @ " + safeDate) + (safeTime.isEmpty() ? "" : " " + safeTime);

        String plainText = buildPlainText(safeTitle, safeDate, safeTime, safeMeet, safeSender, safeDesc);
        String htmlText = buildGoogleMeetHtml(safeTitle, safeDate, safeTime, safeMeet, safeSender, safeDesc);

        System.out.println("==================================================");
        System.out.println("📧 [GMAIL SMTP] Expediere invitație profesională: " + safeTitle);
        System.out.println("📤 Expeditor: " + senderEmail + " (" + safeSender + ")");
        System.out.println("👥 Destinatari: " + toEmails);
        System.out.println("🎥 Link Meet: " + safeMeet);
        System.out.println("==================================================");

        if (mailSender != null) {
            try {
                for (String email : toEmails) {
                    if (email == null || !email.contains("@")) continue;
                    MimeMessage mimeMessage = mailSender.createMimeMessage();
                    MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
                    helper.setFrom(senderEmail, safeSender);
                    helper.setTo(email.trim());
                    helper.setSubject(subject);
                    helper.setText(plainText, htmlText);
                    mailSender.send(mimeMessage);
                }
                System.out.println("✅ Email-uri expediate cu succes prin Gmail SMTP către: " + toEmails);
                return true;
            } catch (Exception e) {
                System.err.println("⚠️ SMTP eroare la trimitere prin " + senderEmail + ": " + e.getMessage());
                return false;
            }
        } else {
            System.out.println("ℹ️ JavaMailSender nu este instanțiat momentan.");
            return false;
        }
    }

    private String buildPlainText(String title, String date, String time, String meetLink, String sender, String desc) {
        StringBuilder sb = new StringBuilder();
        sb.append("Ai primit o invitație la o ședință pe Google Meet.\n\n");
        sb.append(title).append("\n");
        if (!date.isEmpty() || !time.isEmpty()) {
            sb.append("Când: ").append(date).append(!time.isEmpty() ? " la " + time : "").append("\n");
        }
        sb.append("Organizat de: ").append(sender).append("\n\n");
        sb.append("Intră în apel Google Meet:\n").append(meetLink).append("\n\n");
        if (!desc.isEmpty()) {
            sb.append("Agendă / Notițe:\n").append(desc).append("\n\n");
        }
        sb.append("Invitație expediată automat prin contul ").append(senderEmail).append(" (Workspace).\n");
        return sb.toString();
    }

    private String buildGoogleMeetHtml(String title, String date, String time, String meetLink, String sender, String desc) {
        String whenFormatted = date;
        if (!time.isEmpty()) {
            whenFormatted = date.isEmpty() ? time : date + " · " + time;
        }

        StringBuilder html = new StringBuilder();
        html.append("<!DOCTYPE html>\n");
        html.append("<html lang=\"ro\">\n");
        html.append("<head>\n");
        html.append("  <meta charset=\"utf-8\">\n");
        html.append("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        html.append("  <title>Invitație Google Meet</title>\n");
        html.append("</head>\n");
        html.append("<body style=\"margin: 0; padding: 24px; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #202124;\">\n");
        html.append("  <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #dadce0; overflow: hidden; width: 100%; box-shadow: 0 1px 3px rgba(60,64,67,0.06);\">\n");
        
        // Header card
        html.append("    <tr>\n");
        html.append("      <td style=\"padding: 24px 28px 18px; border-bottom: 1px solid #e8eaed;\">\n");
        html.append("        <div style=\"margin-bottom: 14px;\">\n");
        html.append("          <span style=\"display: inline-block; background-color: #e8f0fe; color: #1a73e8; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.3px;\">Google Meet · Workspace</span>\n");
        html.append("        </div>\n");
        html.append("        <h1 style=\"margin: 0 0 10px 0; font-size: 22px; line-height: 28px; color: #202124; font-weight: 500;\">").append(escapeHtml(title)).append("</h1>\n");
        
        if (!whenFormatted.isEmpty()) {
            html.append("        <div style=\"font-size: 14px; line-height: 20px; color: #3c4043; margin-bottom: 6px;\">\n");
            html.append("          <strong>Când:</strong> ").append(escapeHtml(whenFormatted)).append("\n");
            html.append("        </div>\n");
        }
        
        html.append("        <div style=\"font-size: 13px; line-height: 18px; color: #5f6368;\">\n");
        html.append("          Organizat de: <strong style=\"color: #202124;\">").append(escapeHtml(sender)).append("</strong>\n");
        html.append("        </div>\n");
        html.append("      </td>\n");
        html.append("    </tr>\n");

        // Action & Link section
        html.append("    <tr>\n");
        html.append("      <td style=\"padding: 24px 28px;\">\n");
        html.append("        <div style=\"margin-bottom: 20px;\">\n");
        html.append("          <a href=\"").append(meetLink).append("\" target=\"_blank\" style=\"display: inline-block; background-color: #1a73e8; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; padding: 11px 24px; border-radius: 4px; box-shadow: 0 1px 2px rgba(66,133,244,0.3);\">Intră cu Google Meet</a>\n");
        html.append("        </div>\n");
        html.append("        <div style=\"font-size: 13px; line-height: 1.5; color: #5f6368;\">\n");
        html.append("          Link ședință: <a href=\"").append(meetLink).append("\" style=\"color: #1a73e8; text-decoration: none; word-break: break-all;\">").append(escapeHtml(meetLink)).append("</a>\n");
        html.append("        </div>\n");

        // Description section if present
        if (!desc.isEmpty()) {
            html.append("        <div style=\"margin-top: 20px; padding: 14px 16px; background-color: #f8f9fa; border-left: 3px solid #1a73e8; border-radius: 4px;\">\n");
            html.append("          <div style=\"font-size: 12px; font-weight: 600; color: #5f6368; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.4px;\">Agendă / Detalii</div>\n");
            html.append("          <div style=\"font-size: 13px; color: #3c4043; line-height: 1.5; white-space: pre-wrap;\">").append(escapeHtml(desc)).append("</div>\n");
            html.append("        </div>\n");
        }

        html.append("      </td>\n");
        html.append("    </tr>\n");

        // Footer
        html.append("    <tr>\n");
        html.append("      <td style=\"padding: 16px 28px; background-color: #f8f9fa; border-top: 1px solid #e8eaed; font-size: 11px; color: #70757a; line-height: 1.5;\">\n");
        html.append("        Ai primit această invitație deoarece ai fost adăugat la o ședință pe platforma Workspace.<br>\n");
        html.append("        Expediat automat prin contul oficial <a href=\"mailto:").append(senderEmail).append("\" style=\"color: #5f6368; text-decoration: underline;\">").append(senderEmail).append("</a>\n");
        html.append("      </td>\n");
        html.append("    </tr>\n");
        
        html.append("  </table>\n");
        html.append("</body>\n");
        html.append("</html>");
        return html.toString();
    }

    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;")
                   .replace("\"", "&quot;")
                   .replace("'", "&#39;");
    }
}
