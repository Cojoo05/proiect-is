package com.proiect.is.proiect_is.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String role;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private Boolean archived = false;

    @Column(name = "google_email")
    private String googleEmail;

    @Column(name = "google_id")
    private String googleId;

    @Column(name = "google_synced", columnDefinition = "boolean default false")
    private Boolean googleSynced = false;

    @Transient
    private Boolean hasAdminAccess = false;

    public Boolean getGoogleSynced() {
        return googleSynced != null && googleSynced;
    }

    public void setGoogleSynced(Boolean googleSynced) {
        this.googleSynced = googleSynced;
    }

    public String getGoogleEmail() {
        return googleEmail;
    }

    public void setGoogleEmail(String googleEmail) {
        this.googleEmail = googleEmail;
    }

    public String getGoogleId() {
        return googleId;
    }

    public void setGoogleId(String googleId) {
        this.googleId = googleId;
    }

    public Boolean getArchived() {
        return archived != null && archived;
    }

    public void setArchived(Boolean archived) {
        this.archived = archived;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public Boolean getHasAdminAccess() {
        return hasAdminAccess;
    }

    public void setHasAdminAccess(Boolean hasAdminAccess) {
        this.hasAdminAccess = hasAdminAccess;
    }
}
