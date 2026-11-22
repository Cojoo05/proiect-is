package com.proiect.is.proiect_is.service;

import com.proiect.is.proiect_is.DTO.AppNotificationRequestDTO;
import com.proiect.is.proiect_is.DTO.AppNotificationResponseDTO;
import com.proiect.is.proiect_is.model.AppNotification;

import java.util.List;
import java.util.Map;

/**
 * Contract de servicii pentru gestionarea ciclului de viață al notificărilor din aplicație,
 * marcării stării de citire și distribuirii în timp real prin WebSocket către utilizatori.
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
public interface AppNotificationService {

    /**
     * Returnează toate notificările primite de un anumit utilizator.
     *
     * @param userId ID-ul destinatarului
     * @return Lista notificărilor ordonată descrescător după data emiterii
     */
    List<AppNotification> getAllForUser(Long userId);

    /**
     * Returnează toate notificările formatate ca DTO pentru frontend.
     *
     * @param userId ID-ul destinatarului
     * @return Lista de DTO-uri cu timeAgo calculat
     */
    List<AppNotificationResponseDTO> getAllDTOsForUser(Long userId);

    /**
     * Returnează doar notificările necitite ale utilizatorului.
     *
     * @param userId ID-ul utilizatorului
     * @return Lista notificărilor necitite
     */
    List<AppNotification> getUnreadForUser(Long userId);

    /**
     * Returnează numărul de notificări necitite pentru afișarea insignei (badge) din TopBar.
     *
     * @param userId ID-ul utilizatorului
     * @return Numărul de notificări necitite
     */
    Long getUnreadCount(Long userId);

    /**
     * Creează și persistă o nouă notificare, trimițând un mesaj WebSocket dacă destinatarul este conectat.
     *
     * @param notification Entitatea notificării
     * @return Notificarea salvată
     */
    AppNotification createNotification(AppNotification notification);

    /**
     * Creează o notificare pe baza unui DTO validat.
     *
     * @param requestDTO Datele cererii
     * @return DTO-ul de răspuns îmbogățit
     */
    AppNotificationResponseDTO createNotificationFromDTO(AppNotificationRequestDTO requestDTO);

    /**
     * Generează notificări automate de invitație calendar pentru o listă de utilizatori.
     *
     * @param body Datele cererii de invitație
     * @return Harta cu statusul operației și numărul de invitații generate
     */
    Map<String, Object> createCalendarInvites(Map<String, Object> body);

    /**
     * Marchează o singură notificare ca fiind citită.
     *
     * @param id ID-ul notificării
     * @return Notificarea actualizată sau null dacă nu a fost găsită
     */
    AppNotification markAsRead(Long id);

    /**
     * Marchează toate notificările unui utilizator ca fiind citite.
     *
     * @param userId ID-ul utilizatorului
     * @return Numărul de notificări actualizate
     */
    int markAllAsRead(Long userId);

    /**
     * Șterge definitiv o notificare după ID.
     *
     * @param id ID-ul notificării
     * @return true dacă ștergerea s-a efectuat cu succes
     */
    boolean deleteNotification(Long id);
}
