package com.proiect.is.proiect_is.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;

@Entity
@Table(name = "project_roles")
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class ProjectRole {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String color = "#5a3d5c";

    // --- ACCESE / PERMISIUNI STRICT PE PROIECT ---

    @Column(nullable = false)
    private boolean canCreateTasks = true;

    @Column(nullable = false)
    private boolean canManageTasks = true;

    @Column(nullable = false)
    private boolean canCreateChannels = false;

    @Column(nullable = false)
    private boolean canSendMessages = true;

    @Column(nullable = false)
    private boolean canCreatePolls = true;

    @Column(nullable = false)
    private boolean canVotePolls = true;

    @Column(nullable = false)
    private boolean canManageFiles = true;

    @Column(nullable = false)
    private boolean canInviteMembers = false;

    // "ALL" or comma-separated channel IDs (e.g. "1,2,5")
    @Column(nullable = false)
    private String allowedChannels = "ALL";

    public ProjectRole() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Project getProject() { return project; }
    public void setProject(Project project) { this.project = project; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public boolean isCanCreateTasks() { return canCreateTasks; }
    public void setCanCreateTasks(boolean canCreateTasks) { this.canCreateTasks = canCreateTasks; }

    public boolean isCanManageTasks() { return canManageTasks; }
    public void setCanManageTasks(boolean canManageTasks) { this.canManageTasks = canManageTasks; }

    public boolean isCanCreateChannels() { return canCreateChannels; }
    public void setCanCreateChannels(boolean canCreateChannels) { this.canCreateChannels = canCreateChannels; }

    public boolean isCanSendMessages() { return canSendMessages; }
    public void setCanSendMessages(boolean canSendMessages) { this.canSendMessages = canSendMessages; }

    public boolean isCanCreatePolls() { return canCreatePolls; }
    public void setCanCreatePolls(boolean canCreatePolls) { this.canCreatePolls = canCreatePolls; }

    public boolean isCanVotePolls() { return canVotePolls; }
    public void setCanVotePolls(boolean canVotePolls) { this.canVotePolls = canVotePolls; }

    public boolean isCanManageFiles() { return canManageFiles; }
    public void setCanManageFiles(boolean canManageFiles) { this.canManageFiles = canManageFiles; }

    public boolean isCanInviteMembers() { return canInviteMembers; }
    public void setCanInviteMembers(boolean canInviteMembers) { this.canInviteMembers = canInviteMembers; }

    public String getAllowedChannels() { return allowedChannels; }
    public void setAllowedChannels(String allowedChannels) { this.allowedChannels = allowedChannels; }
}
