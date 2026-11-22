package com.proiect.is.proiect_is.DTO;

import lombok.*;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Data Transfer Object (DTO) pentru transmiterea notificărilor către Frontend.
 *
 * Include câmpuri calculate precum intervalul de timp relativ (ex: "Acum 5 minute",
 * "Ieri", "Acum 2 ore") pentru o experiență modernă în panoul de notificări.
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppNotificationResponseDTO {

    /**
     * ID-ul unic al notificării.
     */
    private Long id;

    /**
     * ID-ul destinatarului.
     */
    private Long recipientUserId;

    /**
     * ID-ul expeditorului (dacă există).
     */
    private Long senderUserId;

    /**
     * Numele expeditorului.
     */
    private String senderName;

    /**
     * Titlul notificării.
     */
    private String title;

    /**
     * Conținutul mesajului.
     */
    private String message;

    /**
     * Categoria notificării.
     */
    private String type;

    /**
     * Link-ul asociat acțiunii.
     */
    private String link;

    /**
     * Starea de citire (true = citită, false = necitită).
     */
    private Boolean isRead;

    /**
     * Data și ora la care a fost creată notificarea.
     */
    private LocalDateTime createdAt;

    /**
     * Format prietenos pentru timpul scurs de la primirea notificării.
     */
    private String timeAgo;

    /**
     * Calculează șirul relativ de timp scurs de la emiterea notificării.
     */
    public void computeTimeAgo() {
        if (this.createdAt == null) {
            this.timeAgo = "Recent";
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        Duration duration = Duration.between(this.createdAt, now);
        long seconds = duration.getSeconds();

        if (seconds < 60) {
            this.timeAgo = "Chiar acum";
        } else if (seconds < 3600) {
            long minutes = seconds / 60;
            this.timeAgo = "Acum " + minutes + (minutes == 1 ? " minut" : " minute");
        } else if (seconds < 86400) {
            long hours = seconds / 3600;
            this.timeAgo = "Acum " + hours + (hours == 1 ? " oră" : " ore");
        } else {
            long days = seconds / 86400;
            this.timeAgo = "Acum " + days + (days == 1 ? " zi" : " zile");
        }
    }
}
