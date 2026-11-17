package com.proiect.is.proiect_is.repository;

import com.proiect.is.proiect_is.model.FeedMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FeedMessageRepository extends JpaRepository<FeedMessage, Long> {
    List<FeedMessage> findByChannelIdOrderBySentAtAsc(Long channelId);
    List<FeedMessage> findByProjectIdOrderBySentAtAsc(Long projectId);
}
