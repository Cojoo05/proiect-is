package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
}