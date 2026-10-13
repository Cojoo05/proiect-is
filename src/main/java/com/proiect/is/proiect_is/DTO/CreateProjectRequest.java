package com.proiect.is.proiect_is.dto;

import java.util.List;

public class CreateProjectRequest {
    private String name;
    private String description;
    private Long ownerId;
    private List<Long> invitedUserIds;

    public CreateProjectRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }

    public List<Long> getInvitedUserIds() { return invitedUserIds; }
    public void setInvitedUserIds(List<Long> invitedUserIds) { this.invitedUserIds = invitedUserIds; }
}