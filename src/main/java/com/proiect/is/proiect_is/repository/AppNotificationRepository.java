package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.AppNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Repository pentru notificările aplicației.
 * Permite interogarea notificărilor per utilizator, marcare citite, etc.
 */
@Repository
public interface AppNotificationRepository extends JpaRepository<AppNotification, Long> {

    /** Returnează toate notificările unui utilizator, sortate descrescător după dată */
    List<AppNotification> findByRecipientUserIdOrderByCreatedAtDesc(Long recipientUserId);

    /** Returnează doar notificările NECITITE ale unui utilizator */
    List<AppNotification> findByRecipientUserIdAndIsReadFalseOrderByCreatedAtDesc(Long recipientUserId);

    /** Numărul de notificări necitite ale unui utilizator */
    @Query("SELECT COUNT(n) FROM AppNotification n WHERE n.recipientUserId = :userId AND n.isRead = false")
    Long countUnreadByUserId(@Param("userId") Long userId);

    /** Marchează toate notificările unui utilizator ca citite */
    @Modifying
    @Transactional
    @Query("UPDATE AppNotification n SET n.isRead = true WHERE n.recipientUserId = :userId AND n.isRead = false")
    int markAllAsReadByUserId(@Param("userId") Long userId);

    /** Marchează o singură notificare ca citită */
    @Modifying
    @Transactional
    @Query("UPDATE AppNotification n SET n.isRead = true WHERE n.id = :id")
    int markAsReadById(@Param("id") Long id);

    /** Returnează notificările de tip calendar_invite pentru un utilizator */
    @Query("SELECT n FROM AppNotification n WHERE n.recipientUserId = :userId AND n.type = 'calendar_invite' ORDER BY n.createdAt DESC")
    List<AppNotification> findCalendarInvitesByUserId(@Param("userId") Long userId);

    /** Returnează ultimele N notificări pentru un utilizator */
    @Query("SELECT n FROM AppNotification n WHERE n.recipientUserId = :userId ORDER BY n.createdAt DESC")
    List<AppNotification> findTop20ByRecipientUserId(@Param("userId") Long userId);
}
