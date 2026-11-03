package com.proiect.is.proiect_is.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "system_roles")
public class SystemRole {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false)
    private Integer adminLevel = 0; // 0 = Standard, 1 = Moderator / Parțial, 2 = Drepturi depline

    @Column(nullable = false)
    private boolean hasFullAccess = false;

    @Column(nullable = false)
    private String color = "#5a3d5c";

    @Column(nullable = false)
    private boolean isDefault = false;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public SystemRole() {}

    public SystemRole(String name, Integer adminLevel, boolean hasFullAccess, String color, boolean isDefault) {
        this.name = name;
        this.adminLevel = adminLevel;
        this.hasFullAccess = hasFullAccess;
        this.color = color;
        this.isDefault = isDefault;
        this.createdAt = LocalDateTime.now();
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

    public Integer getAdminLevel() {
        return adminLevel;
    }

    public void setAdminLevel(Integer adminLevel) {
        this.adminLevel = adminLevel;
    }

    public boolean isHasFullAccess() {
        return hasFullAccess;
    }

    public void setHasFullAccess(boolean hasFullAccess) {
        this.hasFullAccess = hasFullAccess;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public boolean isDefault() {
        return isDefault;
    }

    public void setDefault(boolean aDefault) {
        isDefault = aDefault;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
