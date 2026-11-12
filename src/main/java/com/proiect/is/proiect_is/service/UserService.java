package com.proiect.is.proiect_is.service;

import com.proiect.is.proiect_is.model.User;
import com.proiect.is.proiect_is.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    public boolean checkLogin(String username, String password) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User doesn't exists"));

        if (Boolean.TRUE.equals(user.getArchived())) {
            return false;
        }

        String hash = user.getPassword();

        if (passwordEncoder.matches(password, hash)) {
            return true;
        } else {
            return false;
        }
    }
}
