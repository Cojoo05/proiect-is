package com.proiect.is.proiect_is.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * AppNotification – reprezintă o notificare în aplicație pentru un utilizator.
 * Tipuri posibile: "calendar_invite" (invitație la ședință), "project_invite", etc.
 */
@Entity
@Table(name = "app_notifications")
public class AppNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ID-ul utilizatorului care PRIMEȘTE notificarea */
    @Column(name = "recipient_user_id", nullable = false)
    private Long recipientUserId;

    /** ID-ul utilizatorului care A CREAT evenimentul / a trimis invitația */
    @Column(name = "sender_user_id")
    private Long senderUserId;

    /** Numele afișat al celui care a creat evenimentul */
    @Column(name = "sender_name", length = 150)
    private String senderName;

    /** Tipul notificării: "calendar_invite", "event_reminder", "general" */
    @Column(name = "type", nullable = false, length = 50)
    private String type;

    /** Titlul scurt al notificării */
    @Column(name = "title", nullable = false, length = 255)
    private String title;

    /** Textul descriptiv al notificării */
    @Column(name = "message", length = 500)
    private String message;

    /** Referință la ID-ul evenimentului din calendar (opțional) */
    @Column(name = "event_id")
    private Long eventId;

    /** Titlul evenimentului la care se referă notificarea */
    @Column(name = "event_title", length = 255)
    private String eventTitle;

    /** Data evenimentului (string ISO: yyyy-MM-dd) */
    @Column(name = "event_date", length = 20)
    private String eventDate;

    /** Ora de start a evenimentului */
    @Column(name = "event_start_time", length = 10)
    private String eventStartTime;

    /** Link-ul Google Meet asociat (dacă există) */
    @Column(name = "meet_link", length = 500)
    private String meetLink;

    /** Dacă notificarea a fost citită de destinatar */
    @Column(name = "is_read", nullable = false)
    private Boolean isRead = false;

    /** Timestamp-ul când a fost creată notificarea */
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // ── Constructors ──────────────────────────────────────────────────────────

    public AppNotification() {}

    public AppNotification(Long recipientUserId, Long senderUserId, String senderName,
                           String type, String title, String message) {
        this.recipientUserId = recipientUserId;
        this.senderUserId = senderUserId;
        this.senderName = senderName;
        this.type = type;
        this.title = title;
        this.message = message;
        this.isRead = false;
        this.createdAt = LocalDateTime.now();
    }

    // ── Getters & Setters ─────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getRecipientUserId() { return recipientUserId; }
    public void setRecipientUserId(Long recipientUserId) { this.recipientUserId = recipientUserId; }

    public Long getSenderUserId() { return senderUserId; }
    public void setSenderUserId(Long senderUserId) { this.senderUserId = senderUserId; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Long getEventId() { return eventId; }
    public void setEventId(Long eventId) { this.eventId = eventId; }

    public String getEventTitle() { return eventTitle; }
    public void setEventTitle(String eventTitle) { this.eventTitle = eventTitle; }

    public String getEventDate() { return eventDate; }
    public void setEventDate(String eventDate) { this.eventDate = eventDate; }

    public String getEventStartTime() { return eventStartTime; }
    public void setEventStartTime(String eventStartTime) { this.eventStartTime = eventStartTime; }

    public String getMeetLink() { return meetLink; }
    public void setMeetLink(String meetLink) { this.meetLink = meetLink; }

    public Boolean getIsRead() { return isRead; }
    public void setIsRead(Boolean isRead) { this.isRead = isRead; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    @Override
    public String toString() {
        return "AppNotification{id=" + id + ", recipientUserId=" + recipientUserId +
               ", type='" + type + "', title='" + title + "', isRead=" + isRead + "}";
    }
}
