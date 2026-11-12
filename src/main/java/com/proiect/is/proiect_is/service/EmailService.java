package com.proiect.is.proiect_is.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    /**
     * Trimite email de invitație la o ședință Google Meet către o listă de adrese.
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

        String subject = "Invitatie Sedinta: " + eventTitle;

        StringBuilder body = new StringBuilder();
        body.append("Buna ziua,\n\n");
        if (senderName != null && !senderName.isBlank()) {
            body.append(senderName).append(" te-a invitat la o sedinta Google Meet.\n\n");
        } else {
            body.append("Ai fost invitat(a) la o sedinta Google Meet.\n\n");
        }

        body.append("--------------------------------------------------\n");
        body.append("Detalii Eveniment:\n");
        body.append("Titlu: ").append(eventTitle).append("\n");
        if (eventDate != null) body.append("Data: ").append(eventDate).append("\n");
        if (startTime != null && !startTime.isBlank()) body.append("Ora: ").append(startTime).append("\n");
        if (description != null && !description.isBlank()) body.append("Descriere: ").append(description).append("\n");
        body.append("--------------------------------------------------\n\n");

        if (meetLink != null && !meetLink.isBlank()) {
            body.append("Link Google Meet pentru a intra in sedinta:\n");
            body.append(meetLink).append("\n\n");
        }

        body.append("Proiect Ingineria Software\n");

        // Daca JavaMailSender este configurat in application.properties, trimitem email real
        if (mailSender != null) {
            try {
                for (String email : toEmails) {
                    if (email == null || !email.contains("@")) continue;
                    SimpleMailMessage message = new SimpleMailMessage();
                    message.setTo(email.trim());
                    message.setSubject(subject);
                    message.setText(body.toString());
                    mailSender.send(message);
                }
                System.out.println("Email-uri trimise cu succes prin JavaMailSender catre: " + toEmails);
                return true;
            } catch (Exception e) {
                System.err.println("Eroare la trimiterea prin JavaMailSender: " + e.getMessage());
                // Fallback: logare detaliată
            }
        } else {
            System.out.println("JavaMailSender nu este activat (lipsesc configurari SMTP). Invitatia a fost inregistrata pentru: " + toEmails);
        }

        return false;
    }
}
