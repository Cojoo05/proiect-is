package com.proiect.is.proiect_is.service;

import com.proiect.is.proiect_is.model.CalendarEvent;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Serviciu specializat pentru generarea și parsarea fișierelor de calendar
 * în format standard iCalendar (RFC 5545, extensie .ics).
 *
 * Permite exportul evenimentelor și sincronizarea acestora cu aplicații externe:
 * Google Calendar, Microsoft Outlook, Apple Calendar, Mozilla Thunderbird etc.
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
@Service
public class IcsCalendarService {

    private static final String CRLF = "\r\n";
    private static final DateTimeFormatter ICS_DATE_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");
    private static final DateTimeFormatter ICS_DATE_ONLY = DateTimeFormatter.ofPattern("yyyyMMdd");

    /**
     * Generează un șir conform standardului RFC 5545 pentru o listă de evenimente.
     *
     * @param events Lista de evenimente din baza de date
     * @param calendarName Numele calendarului afișat în aplicația client externă
     * @return Conținutul complet al fișierului .ics
     */
    public String generateIcsContent(List<CalendarEvent> events, String calendarName) {
        StringBuilder sb = new StringBuilder();

        // Antetul VCALENDAR
        sb.append("BEGIN:VCALENDAR").append(CRLF);
        sb.append("VERSION:2.0").append(CRLF);
        sb.append("PRODID:-//Workspace IS//Calendar Module 2.0//RO").append(CRLF);
        sb.append("CALSCALE:GREGORIAN").append(CRLF);
        sb.append("METHOD:PUBLISH").append(CRLF);
        sb.append("X-WR-CALNAME:").append(escapeIcsText(calendarName != null ? calendarName : "Workspace IS Calendar")).append(CRLF);
        sb.append("X-WR-TIMEZONE:Europe/Bucharest").append(CRLF);

        String nowUtc = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss"));

        if (events != null) {
            for (CalendarEvent event : events) {
                appendEventToIcs(sb, event, nowUtc);
            }
        }

        sb.append("END:VCALENDAR").append(CRLF);
        return sb.toString();
    }

    /**
     * Adaugă un bloc VEVENT pentru un eveniment dat.
     */
    private void appendEventToIcs(StringBuilder sb, CalendarEvent event, String dtStamp) {
        if (event == null || event.getTitle() == null) {
            return;
        }

        sb.append("BEGIN:VEVENT").append(CRLF);

        // UID unic pentru eveniment
        String uid = (event.getId() != null ? "event-" + event.getId() : UUID.randomUUID().toString())
                + "@proiect-is.workspace.local";
        sb.append("UID:").append(uid).append(CRLF);
        sb.append("DTSTAMP:").append(dtStamp).append("Z").append(CRLF);

        // Parsare și formatare DTSTART / DTEND
        formatEventDates(sb, event);

        // Titlu (SUMMARY)
        sb.append("SUMMARY:").append(escapeIcsText(event.getTitle())).append(CRLF);

        // Descriere detaliată
        StringBuilder descBuilder = new StringBuilder();
        if (event.getDescription() != null && !event.getDescription().isBlank()) {
            descBuilder.append(event.getDescription().trim());
        }
        if (Boolean.TRUE.equals(event.getHasVideoMeet()) && event.getMeetLink() != null) {
            if (descBuilder.length() > 0) descBuilder.append("\n\n");
            descBuilder.append("Link Google Meet: ").append(event.getMeetLink());
        }
        if (descBuilder.length() > 0) {
            sb.append("DESCRIPTION:").append(escapeIcsText(descBuilder.toString())).append(CRLF);
        }

        // Locație sau link videoconferință
        if (Boolean.TRUE.equals(event.getHasVideoMeet()) && event.getMeetLink() != null) {
            sb.append("LOCATION:").append(escapeIcsText(event.getMeetLink())).append(CRLF);
            sb.append("URL:").append(escapeIcsText(event.getMeetLink())).append(CRLF);
        } else if (event.getLocation() != null && !event.getLocation().isBlank()) {
            sb.append("LOCATION:").append(escapeIcsText(event.getLocation())).append(CRLF);
        }

        // Categorie și prioritate
        if (event.getCategory() != null) {
            sb.append("CATEGORIES:").append(escapeIcsText(event.getCategory())).append(CRLF);
        }
        if (event.getPriority() != null) {
            int priorityLevel = switch (event.getPriority().toLowerCase()) {
                case "urgent", "high" -> 1;
                case "medium" -> 5;
                case "low" -> 9;
                default -> 0;
            };
            if (priorityLevel > 0) {
                sb.append("PRIORITY:").append(priorityLevel).append(CRLF);
            }
        }

        // Recurență
        if (event.getRecurrence() != null && !event.getRecurrence().equalsIgnoreCase("none")) {
            String freq = switch (event.getRecurrence().toLowerCase()) {
                case "daily" -> "DAILY";
                case "weekly" -> "WEEKLY";
                case "monthly" -> "MONTHLY";
                default -> null;
            };
            if (freq != null) {
                sb.append("RRULE:FREQ=").append(freq).append(CRLF);
            }
        }

        sb.append("STATUS:CONFIRMED").append(CRLF);
        sb.append("TRANSP:OPAQUE").append(CRLF);
        sb.append("END:VEVENT").append(CRLF);
    }

    /**
     * Formatează DTSTART și DTEND în funcție de caracterul de eveniment de o zi întreagă sau cu orar specific.
     */
    private void formatEventDates(StringBuilder sb, CalendarEvent event) {
        String eventDate = event.getEventDate();
        if (eventDate == null || eventDate.isBlank()) {
            eventDate = LocalDate.now().toString();
        }

        // Format curat fără cratime pentru iCal: YYYYMMDD
        String cleanDate = eventDate.replace("-", "");

        if (Boolean.TRUE.equals(event.getAllDay()) || event.getStartTime() == null || event.getStartTime().isBlank()) {
            sb.append("DTSTART;VALUE=DATE:").append(cleanDate).append(CRLF);
            sb.append("DTEND;VALUE=DATE:").append(cleanDate).append(CRLF);
        } else {
            String startHour = formatTimeIcs(event.getStartTime());
            sb.append("DTSTART:").append(cleanDate).append("T").append(startHour).append("00").append(CRLF);

            String endHour = (event.getEndTime() != null && !event.getEndTime().isBlank())
                    ? formatTimeIcs(event.getEndTime())
                    : formatTimeIcs(addOneHour(event.getStartTime()));
            sb.append("DTEND:").append(cleanDate).append("T").append(endHour).append("00").append(CRLF);
        }
    }

    private String formatTimeIcs(String timeStr) {
        if (timeStr == null || !timeStr.contains(":")) return "0900";
        String[] parts = timeStr.split(":");
        String h = parts[0].trim();
        String m = parts.length > 1 ? parts[1].trim() : "00";
        if (h.length() == 1) h = "0" + h;
        if (m.length() == 1) m = "0" + m;
        return h + m;
    }

    private String addOneHour(String timeStr) {
        try {
            String[] parts = timeStr.split(":");
            int hour = Integer.parseInt(parts[0].trim()) + 1;
            int minute = parts.length > 1 ? Integer.parseInt(parts[1].trim()) : 0;
            if (hour > 23) hour = 23;
            return String.format("%02d:%02d", hour, minute);
        } catch (Exception e) {
            return "10:00";
        }
    }

    /**
     * Tratează caracterele speciale iCalendar conform specificației RFC 5545.
     */
    private String escapeIcsText(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\")
                   .replace(";", "\\;")
                   .replace(",", "\\,")
                   .replace("\r\n", "\\n")
                   .replace("\n", "\\n")
                   .replace("\r", "\\n");
    }

    /**
     * Parsează conținutul unui fișier .ics primit la import și creează o listă de entități CalendarEvent.
     *
     * @param icsContent Textul brut al fișierului iCalendar
     * @param userId ID-ul utilizatorului proprietar
     * @param projectId ID-ul proiectului asociat (opțional)
     * @return Lista de entități CalendarEvent gata de a fi salvate
     */
    public List<CalendarEvent> parseIcsContent(String icsContent, Long userId, Long projectId) {
        List<CalendarEvent> importedEvents = new ArrayList<>();
        if (icsContent == null || icsContent.isBlank()) {
            return importedEvents;
        }

        String[] lines = icsContent.split("\\r?\\n");
        CalendarEvent currentEvent = null;
        boolean inVevent = false;

        for (String rawLine : lines) {
            String line = rawLine.trim();

            if (line.equalsIgnoreCase("BEGIN:VEVENT")) {
                inVevent = true;
                currentEvent = new CalendarEvent();
                currentEvent.setUserId(userId);
                currentEvent.setProjectId(projectId);
                currentEvent.setCompleted(false);
                currentEvent.setIsDelayed(false);
                currentEvent.setCreatedAt(LocalDateTime.now());
                currentEvent.setPriority("medium");
                currentEvent.setCategory("Sedinta");
                continue;
            }

            if (line.equalsIgnoreCase("END:VEVENT")) {
                if (currentEvent != null && currentEvent.getTitle() != null) {
                    if (currentEvent.getEventDate() == null) {
                        currentEvent.setEventDate(LocalDate.now().toString());
                    }
                    importedEvents.add(currentEvent);
                }
                inVevent = false;
                currentEvent = null;
                continue;
            }

            if (!inVevent || currentEvent == null) {
                continue;
            }

            // Parsare proprietăți VEVENT
            if (line.startsWith("SUMMARY:")) {
                currentEvent.setTitle(unescapeIcsText(line.substring(8)));
            } else if (line.startsWith("DESCRIPTION:")) {
                currentEvent.setDescription(unescapeIcsText(line.substring(12)));
            } else if (line.startsWith("LOCATION:")) {
                currentEvent.setLocation(unescapeIcsText(line.substring(9)));
            } else if (line.startsWith("URL:")) {
                String url = line.substring(4).trim();
                currentEvent.setMeetLink(url);
                if (url.contains("meet.google.com")) {
                    currentEvent.setHasVideoMeet(true);
                    currentEvent.setMeetPlatform("Google Meet");
                }
            } else if (line.startsWith("DTSTART")) {
                parseDtStart(line, currentEvent);
            } else if (line.startsWith("CATEGORIES:")) {
                currentEvent.setCategory(unescapeIcsText(line.substring(11)));
            }
        }

        return importedEvents;
    }

    private void parseDtStart(String line, CalendarEvent event) {
        try {
            int colonIdx = line.indexOf(':');
            if (colonIdx == -1) return;
            String val = line.substring(colonIdx + 1).trim();

            if (val.contains("T")) {
                // Format YYYYMMDDTHHMMSS
                String datePart = val.substring(0, val.indexOf('T'));
                String timePart = val.substring(val.indexOf('T') + 1);

                if (datePart.length() >= 8) {
                    String y = datePart.substring(0, 4);
                    String m = datePart.substring(4, 6);
                    String d = datePart.substring(6, 8);
                    event.setEventDate(y + "-" + m + "-" + d);
                }

                if (timePart.length() >= 4) {
                    String hour = timePart.substring(0, 2);
                    String min = timePart.substring(2, 4);
                    event.setStartTime(hour + ":" + min);
                }
                event.setAllDay(false);
            } else {
                // Format doar dată YYYYMMDD
                if (val.length() >= 8) {
                    String y = val.substring(0, 4);
                    String m = val.substring(4, 6);
                    String d = val.substring(6, 8);
                    event.setEventDate(y + "-" + m + "-" + d);
                }
                event.setAllDay(true);
            }
        } catch (Exception ignored) {}
    }

    private String unescapeIcsText(String text) {
        if (text == null) return "";
        return text.replace("\\n", "\n")
                   .replace("\\,", ",")
                   .replace("\\;", ";")
                   .replace("\\\\", "\\");
    }
}
