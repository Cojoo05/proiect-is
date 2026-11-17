package com.proiect.is.proiect_is.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "calendar_events")
public class CalendarEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false)
    private String eventDate; // Format: YYYY-MM-DD

    @Column
    private String startTime; // Format: HH:mm

    @Column
    private String endTime; // Format: HH:mm

    @Column(nullable = false)
    private Boolean allDay = false;

    @Column(nullable = false)
    private String category = "meeting"; // meeting, video_call, deadline, consultation, presentation, workshop

    @Column(nullable = false)
    private String priority = "medium"; // low, medium, high

    @Column(nullable = false)
    private String recurrence = "none"; // none, DAILY, WEEKLY

    @Column(nullable = false)
    private Boolean hasVideoMeet = false;

    @Column(length = 1000)
    private String meetLink;

    @Column
    private String meetPlatform = "Google Meet"; // Google Meet, Jitsi Meet, Zoom, Teams, In-App

    @Column
    private String meetRoomCode;

    @Column
    private String location;

    @Column(length = 1000)
    private String attendees;

    @Column
    private Boolean completed = false;

    @Column
    private Boolean isGoogle = false;

    @Column
    private String googleEventId;

    @Column
    private Long projectId;

    @Column
    private Long userId;

    @Column
    private Boolean isDelayed = false;

    @Column
    private String delayReason;

    @Column
    private LocalDateTime createdAt = LocalDateTime.now();

    public CalendarEvent() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getEventDate() {
        return eventDate;
    }

    public void setEventDate(String eventDate) {
        this.eventDate = eventDate;
    }

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public String getEndTime() {
        return endTime;
    }

    public void setEndTime(String endTime) {
        this.endTime = endTime;
    }

    public Boolean getAllDay() {
        return allDay;
    }

    public void setAllDay(Boolean allDay) {
        this.allDay = allDay;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getRecurrence() {
        return recurrence;
    }

    public void setRecurrence(String recurrence) {
        this.recurrence = recurrence;
    }

    public Boolean getHasVideoMeet() {
        return hasVideoMeet;
    }

    public void setHasVideoMeet(Boolean hasVideoMeet) {
        this.hasVideoMeet = hasVideoMeet;
    }

    public String getMeetLink() {
        return meetLink;
    }

    public void setMeetLink(String meetLink) {
        this.meetLink = meetLink;
    }

    public String getMeetPlatform() {
        return meetPlatform;
    }

    public void setMeetPlatform(String meetPlatform) {
        this.meetPlatform = meetPlatform;
    }

    public String getMeetRoomCode() {
        return meetRoomCode;
    }

    public void setMeetRoomCode(String meetRoomCode) {
        this.meetRoomCode = meetRoomCode;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getAttendees() {
        return attendees;
    }

    public void setAttendees(String attendees) {
        this.attendees = attendees;
    }

    public Boolean getCompleted() {
        return completed;
    }

    public void setCompleted(Boolean completed) {
        this.completed = completed;
    }

    public Boolean getIsGoogle() {
        return isGoogle;
    }

    public void setIsGoogle(Boolean isGoogle) {
        this.isGoogle = isGoogle;
    }

    public String getGoogleEventId() {
        return googleEventId;
    }

    public void setGoogleEventId(String googleEventId) {
        this.googleEventId = googleEventId;
    }

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Boolean getIsDelayed() {
        return isDelayed;
    }

    public void setIsDelayed(Boolean isDelayed) {
        this.isDelayed = isDelayed;
    }

    public String getDelayReason() {
        return delayReason;
    }

    public void setDelayReason(String delayReason) {
        this.delayReason = delayReason;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
