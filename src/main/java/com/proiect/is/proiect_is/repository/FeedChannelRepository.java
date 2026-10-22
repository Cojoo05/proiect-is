package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.FeedChannel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FeedChannelRepository extends JpaRepository<FeedChannel, Long> {
    List<FeedChannel> findByProjectId(Long projectId);
}
