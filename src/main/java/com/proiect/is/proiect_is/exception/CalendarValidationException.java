package com.proiect.is.proiect_is.exception;

import java.util.List;

/**
 * Excepție aruncată în cazul în care datele introduse pentru un eveniment din calendar
 * nu respectă regulile de business (ex: data de sfârșit este înaintea datei de început,
 * format de dată invalid etc.).
 *
 * @author alexcimpean20
 * @version 2.0
 * @since 2026-11-22
 */
public class CalendarValidationException extends RuntimeException {

    private List<String> validationErrors;

    public CalendarValidationException(String message) {
        super(message);
    }

    public CalendarValidationException(String message, List<String> validationErrors) {
        super(message);
        this.validationErrors = validationErrors;
    }

    public List<String> getValidationErrors() {
        return validationErrors;
    }
}
