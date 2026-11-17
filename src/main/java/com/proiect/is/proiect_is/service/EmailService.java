package com.proiect.is.proiect_is.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:proiect.is19@gmail.com}")
    private String senderEmail;

    /**
     * Trimite email automat de invitație la o ședință Google Meet de pe contul proiect.is19@gmail.com.
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

        String subject = "📅 Invitație Ședință Google Meet: " + eventTitle;

        StringBuilder body = new StringBuilder();
        body.append("Bună ziua,\n\n");
        if (senderName != null && !senderName.isBlank()) {
            body.append(senderName).append(" te-a invitat la o ședință pe Google Meet.\n\n");
        } else {
            body.append("Ai primit o invitație la o ședință pe Google Meet.\n\n");
        }

        body.append("==================================================\n");
        body.append("DETALII ȘEDINȚĂ:\n");
        body.append("📌 Titlu: ").append(eventTitle).append("\n");
        if (eventDate != null) body.append("📅 Dată: ").append(eventDate).append("\n");
        if (startTime != null && !startTime.isBlank()) body.append("⏰ Oră: ").append(startTime).append("\n");
        if (description != null && !description.isBlank()) body.append("📝 Agendă / Detalii: ").append(description).append("\n");
        body.append("==================================================\n\n");

        if (meetLink != null && !meetLink.isBlank()) {
            body.append("🎥 LINK GOOGLE MEET PENTRU A INTRA ÎN APEL:\n");
            body.append(meetLink).append("\n\n");
            body.append("Apasă pe link-ul de mai sus la ora stabilită pentru a te conecta.\n\n");
        }

        body.append("Mesaj trimis automat de contul ").append(senderEmail).append(" (Proiect IS).\n");

        System.out.println("==================================================");
        System.out.println("📧 [GMAIL SMTP DISPATCHER] Trimitere invitație de la: " + senderEmail);
        System.out.println("📌 Ședință: " + eventTitle);
        System.out.println("📅 Dată: " + eventDate + " la ora " + startTime);
        System.out.println("🎥 Link: " + meetLink);
        System.out.println("👥 Destinatari: " + toEmails);
        System.out.println("==================================================");

        if (mailSender != null) {
            try {
                for (String email : toEmails) {
                    if (email == null || !email.contains("@")) continue;
                    SimpleMailMessage message = new SimpleMailMessage();
                    message.setFrom(senderEmail);
                    message.setTo(email.trim());
                    message.setSubject(subject);
                    message.setText(body.toString());
                    mailSender.send(message);
                }
                System.out.println("✅ Email-uri trimise cu succes prin Gmail SMTP (" + senderEmail + ") către: " + toEmails);
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
}
