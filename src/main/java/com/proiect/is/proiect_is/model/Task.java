package com.proiect.is.proiect_is.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private LocalDateTime creationDate;

    @Column
    private LocalDateTime dueLine;

    @ManyToOne
    @JoinColumn(name = "creator_id", nullable = false)
    User creator;

    @ManyToOne
    @JoinColumn(name = "assignee_id")
    User assignee;

    @Column(nullable = false)
    String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @Transient
    private Long projectId;

    // Coloana (bucket) din board-ul personal al asignatarului; null = prima coloană
    @Column
    private Long bucketId;

    // Culoarea cartonașului, ex: "#fef9c3"; null = culoarea implicită
    @Column(length = 20)
    private String color;

    public Long getBucketId() { return bucketId; }
    public void setBucketId(Long bucketId) { this.bucketId = bucketId; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDateTime getCreationDate() { return creationDate; }
    public void setCreationDate(LocalDateTime creationDate) { this.creationDate = creationDate; }
    public LocalDateTime getDueLine() { return dueLine; }
    public void setDueLine(LocalDateTime dueLine) { this.dueLine = dueLine; }
    public User getCreator() { return creator; }
    public void setCreator(User creator) { this.creator = creator; }
    public User getAssignee() { return assignee; }
    public void setAssignee(User assignee) { this.assignee = assignee; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }
    public Long getProjectId() { return project != null ? project.getId() : projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }
}
