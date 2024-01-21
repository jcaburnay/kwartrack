WITH
  __param__pIds := <array<std::uuid>>$pIds,
  __param__cIds := <array<std::uuid>>$cIds,
  __param__isOverall := <std::bool>$isOverall,
  __param__tssDate := <OPTIONAL std::datetime>$tssDate,
  __param__tseDate := <OPTIONAL std::datetime>$tseDate
SELECT (WITH
  __transactions := (
    WITH
      __cid_set := std::array_unpack(__param__cIds),
      __pid_set := std::array_unpack(__param__pIds),
    SELECT default::ETransaction {
      id
    }
    FILTER (
      .is_visible
      and
      (
        __param__isOverall
        or (
          (IF (exists __param__tssDate) THEN (.date >= __param__tssDate) ELSE true)
          and
          (IF (exists __param__tseDate) THEN (.date < __param__tseDate) ELSE true)
        )
      )
      and
      (IF (exists __cid_set) THEN (.category.id in __cid_set) ELSE true)
      and
      (
        IF (exists __pid_set)
        THEN (
          IF (.category.kind = ECategoryKind.Transfer)
          THEN (
            (
              IF (
                (.source_partition.id in __pid_set)
                and
                ((.counterpart.source_partition.id union .<counterpart[is ETransaction].source_partition.id) in __pid_set)
              )
              THEN false
              ELSE (.source_partition.id in __pid_set)
            )
          )
          ELSE (.source_partition.id in __pid_set)
        )
        ELSE (
          IF (.category.kind = ECategoryKind.Transfer)
          THEN (
            IF (
              .is_visible
              and
              (.counterpart.is_visible union .<counterpart[is ETransaction].is_visible)
            )
            THEN false
            ELSE .is_visible
          )
          ELSE true
        )
      )
    )
  ),
  __groups := (
    GROUP __transactions
    USING
      date_str := IF __param__isOverall THEN to_str(.date, "YYYY-MM") ELSE to_str(.date, "YYYY-MM-DD"),
    BY date_str
)
SELECT __groups {
  key: { date_str },
  total := std::sum(.elements.value)
})
