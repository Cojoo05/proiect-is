package com.proiect.is.proiect_is.exception;

/**
 * Excepție aruncată în momentul în care o resursă din cadrul modulului Calendar
 * (eveniment, ședință sau înregistrare conexă) nu este găsită în baza de date.
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
public class CalendarResourceNotFoundException extends RuntimeException {

    public CalendarResourceNotFoundException(String message) {
        super(message);
    }

    public CalendarResourceNotFoundException(Long id) {
        super("Evenimentul din calendar cu ID-ul " + id + " nu a fost găsit.");
    }
}
