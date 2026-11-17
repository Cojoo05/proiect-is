package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.CalendarEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

    List<CalendarEvent> findByUserId(Long userId);

    List<CalendarEvent> findByProjectId(Long projectId);

    List<CalendarEvent> findByProjectIdAndEventDate(Long projectId, String eventDate);

    List<CalendarEvent> findByUserIdAndEventDate(Long userId, String eventDate);

    List<CalendarEvent> findByHasVideoMeetTrue();

    @Query("SELECT e FROM CalendarEvent e WHERE (e.projectId = :projectId OR e.userId = :userId) AND e.hasVideoMeet = true ORDER BY e.eventDate ASC, e.startTime ASC")
    List<CalendarEvent> findUpcomingMeetings(@Param("projectId") Long projectId, @Param("userId") Long userId);
}
