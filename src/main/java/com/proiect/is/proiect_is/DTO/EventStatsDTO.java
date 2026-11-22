package com.proiect.is.proiect_is.DTO;

import lombok.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Data Transfer Object (DTO) care încapsulează metricele și datele statistice
 * agregate pentru evenimentele unui utilizator sau ale unui proiect.
 *
 * Utilizat în tabloul de bord (Dashboard) și în antetul calendarului pentru
 * afișarea rapidă a volumului de muncă și a gradului de finalizare.
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventStatsDTO {

    /**
     * Numărul total de evenimente înregistrate.
     */
    private long totalEvents;

    /**
     * Numărul de evenimente planificate în viitor.
     */
    private long upcomingEvents;

    /**
     * Numărul de evenimente marcate ca finalizate.
     */
    private long completedEvents;

    /**
     * Numărul de evenimente care au videoconferință activă (Google Meet).
     */
    private long videoMeetingsCount;

    /**
     * Numărul de evenimente sau sarcini care au fost amânate / întârziate.
     */
    private long delayedEventsCount;

    /**
     * Rata de completare a evenimentelor exprimată în procente (0.0% - 100.0%).
     */
    private double completionRate;

    /**
     * Distribuția evenimentelor grupate după categorie (ex: "Sedinta" -> 5, "Review" -> 3).
     */
    @Builder.Default
    private Map<String, Long> eventsByCategory = new HashMap<>();

    /**
     * Distribuția evenimentelor grupate după prioritate (ex: "urgent" -> 2, "high" -> 4).
     */
    @Builder.Default
    private Map<String, Long> eventsByPriority = new HashMap<>();

    /**
     * Calculează automat rata de finalizare a evenimentelor.
     */
    public void calculateCompletionRate() {
        if (this.totalEvents > 0) {
            double rate = ((double) this.completedEvents / (double) this.totalEvents) * 100.0;
            this.completionRate = Math.round(rate * 10.0) / 10.0;
        } else {
            this.completionRate = 0.0;
        }
    }
}
