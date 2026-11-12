package com.proiect.is.proiect_is.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "knowledge_notes")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class KnowledgeNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "LONGTEXT", nullable = false)
    private String content;

    @Column(nullable = false)
    private String category = "General";

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "creator_id", nullable = false)
    @JsonIgnoreProperties({"password", "hibernateLazyInitializer", "handler"})
    private User creator;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(nullable = false)
    private boolean isPinned = false;

    @Column(length = 1000)
    private String youtubeUrl;

    @Column(columnDefinition = "LONGTEXT")
    private String imagesJson; // Stores JSON array of image URLs or base64 data strings

    @Column(nullable = false, length = 500)
    private String allowedRolesToView = "ALL"; // "ALL" or comma-separated role names e.g. "Admin,Developer"

    @Column(length = 1000)
    private String allowedUserIdsToView = ""; // Comma-separated user IDs e.g. "2,5"

    @Column(nullable = false, length = 500)
    private String allowedRolesToEdit = "ADMIN_CREATOR"; // "ADMIN_CREATOR" or comma-separated roles

    @Column(length = 1000)
    private String allowedUserIdsToEdit = ""; // Comma-separated user IDs e.g. "2,5"

    public KnowledgeNote() {}

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

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public User getCreator() {
        return creator;
    }

    public void setCreator(User creator) {
        this.creator = creator;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public boolean isPinned() {
        return isPinned;
    }

    public void setPinned(boolean pinned) {
        isPinned = pinned;
    }

    public String getYoutubeUrl() {
        return youtubeUrl;
    }

    public void setYoutubeUrl(String youtubeUrl) {
        this.youtubeUrl = youtubeUrl;
    }

    public String getImagesJson() {
        return imagesJson;
    }

    public void setImagesJson(String imagesJson) {
        this.imagesJson = imagesJson;
    }

    public String getAllowedRolesToView() {
        return allowedRolesToView;
    }

    public void setAllowedRolesToView(String allowedRolesToView) {
        this.allowedRolesToView = allowedRolesToView;
    }

    public String getAllowedRolesToEdit() {
        return allowedRolesToEdit;
    }

    public void setAllowedRolesToEdit(String allowedRolesToEdit) {
        this.allowedRolesToEdit = allowedRolesToEdit;
    }

    public String getAllowedUserIdsToView() {
        return allowedUserIdsToView;
    }

    public void setAllowedUserIdsToView(String allowedUserIdsToView) {
        this.allowedUserIdsToView = allowedUserIdsToView;
    }

    public String getAllowedUserIdsToEdit() {
        return allowedUserIdsToEdit;
    }

    public void setAllowedUserIdsToEdit(String allowedUserIdsToEdit) {
        this.allowedUserIdsToEdit = allowedUserIdsToEdit;
    }
}
