package com.proiect.is.proiect_is.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "knowledge_folders")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class KnowledgeFolder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "parent_id")
    private Long parentId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "creator_id")
    @JsonIgnoreProperties({"password", "hibernateLazyInitializer", "handler"})
    private User creator;

    @Column(nullable = false, length = 500)
    private String allowedRolesToView = "ALL"; // "ALL" or comma-separated roles

    @Column(nullable = false, length = 500)
    private String allowedRolesToWrite = "ADMIN_CREATOR"; // "ADMIN_CREATOR" or comma-separated roles

    @Column(nullable = false, length = 500)
    private String allowedRolesToEdit = "ADMIN_CREATOR"; // "ADMIN_CREATOR" or comma-separated roles

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public KnowledgeFolder() {}

    public KnowledgeFolder(String name, Long parentId, User creator) {
        this.name = name;
        this.parentId = parentId;
        this.creator = creator;
        this.allowedRolesToView = "ALL";
        this.allowedRolesToWrite = "ADMIN_CREATOR";
        this.allowedRolesToEdit = "ADMIN_CREATOR";
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public KnowledgeFolder(String name, Long parentId, User creator, String allowedRolesToView, String allowedRolesToWrite, String allowedRolesToEdit) {
        this.name = name;
        this.parentId = parentId;
        this.creator = creator;
        this.allowedRolesToView = (allowedRolesToView != null && !allowedRolesToView.trim().isEmpty()) ? allowedRolesToView : "ALL";
        this.allowedRolesToWrite = (allowedRolesToWrite != null && !allowedRolesToWrite.trim().isEmpty()) ? allowedRolesToWrite : "ADMIN_CREATOR";
        this.allowedRolesToEdit = (allowedRolesToEdit != null && !allowedRolesToEdit.trim().isEmpty()) ? allowedRolesToEdit : "ADMIN_CREATOR";
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }

    public User getCreator() {
        return creator;
    }

    public void setCreator(User creator) {
        this.creator = creator;
    }

    public String getAllowedRolesToView() {
        return allowedRolesToView;
    }

    public void setAllowedRolesToView(String allowedRolesToView) {
        this.allowedRolesToView = allowedRolesToView;
    }

    public String getAllowedRolesToWrite() {
        return allowedRolesToWrite;
    }

    public void setAllowedRolesToWrite(String allowedRolesToWrite) {
        this.allowedRolesToWrite = allowedRolesToWrite;
    }

    public String getAllowedRolesToEdit() {
        return allowedRolesToEdit;
    }

    public void setAllowedRolesToEdit(String allowedRolesToEdit) {
        this.allowedRolesToEdit = allowedRolesToEdit;
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
}
