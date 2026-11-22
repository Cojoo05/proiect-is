package com.proiect.is.proiect_is.service;

import com.proiect.is.proiect_is.DTO.CalendarEventRequestDTO;
import com.proiect.is.proiect_is.DTO.CalendarEventResponseDTO;
import com.proiect.is.proiect_is.DTO.CalendarInviteRequestDTO;
import com.proiect.is.proiect_is.DTO.EventStatsDTO;
import com.proiect.is.proiect_is.model.CalendarEvent;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Interfață de servicii care definește contractul de business pentru gestionarea
 * calendarului de evenimente, planificării ședințelor și sincronizării acestora.
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
public interface CalendarEventService {

    /**
     * Returnează toate evenimentele înregistrate în sistem.
     *
     * @return Lista completă de evenimente
     */
    List<CalendarEvent> getAllEvents();

    /**
     * Caută un eveniment după ID-ul său primar.
     *
     * @param id Identificatorul evenimentului
     * @return Optional cu evenimentul găsit
     */
    Optional<CalendarEvent> getEventById(Long id);

    /**
     * Returnează evenimentele planificate de un anumit utilizator.
     *
     * @param userId ID-ul utilizatorului
     * @return Lista evenimentelor utilizatorului
     */
    List<CalendarEvent> getEventsByUser(Long userId);

    /**
     * Returnează evenimentele asociate unui proiect specific.
     *
     * @param projectId ID-ul proiectului
     * @return Lista evenimentelor din proiect
     */
    List<CalendarEvent> getEventsByProject(Long projectId);

    /**
     * Returnează evenimentele dintr-un proiect pentru o dată calendaristică specifică.
     *
     * @param projectId ID-ul proiectului
     * @param date Data în format YYYY-MM-DD
     * @return Lista evenimentelor filtrate
     */
    List<CalendarEvent> getProjectEventsByDate(Long projectId, String date);

    /**
     * Returnează ședințele viitoare ce conțin conferință video (Google Meet).
     *
     * @param projectId ID proiect opțional
     * @param userId ID utilizator opțional
     * @return Lista ședințelor video viitoare
     */
    List<CalendarEvent> getUpcomingMeetings(Long projectId, Long userId);

    /**
     * Salvează și procesează un eveniment nou, inițiind automat link-ul Google Meet
     * și expediind invitațiile pe email participanților specificați.
     *
     * @param event Entitatea eveniment primită
     * @return Evenimentul persistat
     */
    CalendarEvent createEvent(CalendarEvent event);

    /**
     * Creează un eveniment validat pe baza unui DTO.
     *
     * @param requestDTO Datele validate din cerere
     * @return DTO-ul de răspuns îmbogățit
     */
    CalendarEventResponseDTO createEventFromDTO(CalendarEventRequestDTO requestDTO);

    /**
     * Actualizează atributele unui eveniment existent.
     *
     * @param id ID-ul evenimentului de actualizat
     * @param updatedData Noile date ale evenimentului
     * @return Optional cu evenimentul actualizat
     */
    Optional<CalendarEvent> updateEvent(Long id, CalendarEvent updatedData);

    /**
     * Șterge definitiv un eveniment după ID.
     *
     * @param id ID-ul evenimentului
     * @return true dacă a fost șters, false dacă nu a fost găsit
     */
    boolean deleteEvent(Long id);

    /**
     * Calculează statisticile agregate pentru un utilizator sau un proiect.
     *
     * @param userId ID utilizator (opțional)
     * @param projectId ID proiect (opțional)
     * @return Obiectul EventStatsDTO cu metrice complete
     */
    EventStatsDTO getEventStatistics(Long userId, Long projectId);

    /**
     * Generează conținutul fișierului iCalendar (.ics) pentru evenimentele unui utilizator.
     *
     * @param userId ID-ul utilizatorului
     * @return Șirul conform RFC 5545
     */
    String exportUserEventsIcs(Long userId);

    /**
     * Generează conținutul fișierului iCalendar (.ics) pentru evenimentele unui proiect.
     *
     * @param projectId ID-ul proiectului
     * @return Șirul conform RFC 5545
     */
    String exportProjectEventsIcs(Long projectId);

    /**
     * Generează conținutul fișierului iCalendar (.ics) pentru un singur eveniment specific.
     *
     * @param eventId ID-ul evenimentului
     * @return Șirul conform RFC 5545
     */
    String exportSingleEventIcs(Long eventId);

    /**
     * Importă evenimente dintr-un fișier .ics și le asociază unui utilizator.
     *
     * @param icsContent Textul brut al fișierului .ics
     * @param userId ID-ul utilizatorului
     * @param projectId ID-ul proiectului (opțional)
     * @return Numărul de evenimente importate cu succes
     */
    int importEventsFromIcs(String icsContent, Long userId, Long projectId);

    /**
     * Expediază invitații electronice (email) către participanți.
     *
     * @param inviteRequest Datele cererii de invitație
     * @return true dacă email-urile au fost expediate cu succes
     */
    boolean sendMeetingInvitations(CalendarInviteRequestDTO inviteRequest);

    /**
     * Generează datele unei ședințe rapide ad-hoc (Quick Meet).
     *
     * @param platform Numele platformei (ex: "Google Meet")
     * @param title Titlul ședinței
     * @return Harta cu link-ul de acces și codul camerei
     */
    Map<String, Object> generateQuickMeet(String platform, String title);
}
