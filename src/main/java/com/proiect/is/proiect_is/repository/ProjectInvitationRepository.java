package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.ProjectInvitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ProjectInvitationRepository extends JpaRepository<ProjectInvitation, Long> {

    @Query("SELECT pi FROM ProjectInvitation pi " +
            "WHERE pi.invitedUser.id = :userId " +
            "AND pi.status = 'PENDING' " +
            "AND pi.expiresAt > :now " +
            "ORDER BY pi.createdAt DESC")
    List<ProjectInvitation> findActivePendingInvitations(
            @Param("userId") Long userId,
            @Param("now") LocalDateTime now
    );
}