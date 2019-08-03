
-- Sample queries

-- Fingerprints by name
select fp.name as fingerprint_name, r.name as name
  from repo_snapshots r, repo_fingerprints j, fingerprints fp
  where j.repo_snapshot_id = r.id and j.fingerprint_id = fp.id;

-- Fingerprint names
select fp.name as fingerprint_name, r.name as name
  from repo_snapshots r, repo_fingerprints j, fingerprints fp
  where j.repo_snapshot_id = r.id and j.fingerprint_id = fp.id
  group by fp.name, r.name;

-- Variance for fingerprint name
select fp.name as fingerprint_name, fp.sha as fingerprint_sha, r.name as name
  from repo_snapshots r, repo_fingerprints j, fingerprints fp
  where j.repo_snapshot_id = r.id and j.fingerprint_id = fp.id
    and fp.name = 'typescript-version'
  group by fp.name, r.name, fp.sha
  order by fp.sha;

-- Example fingerprints tree query using PostgreSQL JSON
SELECT row_to_json(fingerprint_groups) FROM (SELECT json_agg(fp) children
FROM (
       SELECT
         fingerprints.id as id, fingerprints.name as name, fingerprints.sha as sha, fingerprints.data as data, fingerprints.feature_name as type,
         (
           SELECT json_agg(row_to_json(repo))
           FROM (
                  SELECT
                    repo_snapshots.owner, repo_snapshots.name, repo_snapshots.url, 1 as size
                  FROM repo_fingerprints, repo_snapshots
                   WHERE repo_fingerprints.fingerprint_id = fingerprints.id
                    AND repo_snapshots.id = repo_fingerprints.repo_snapshot_id
                    AND workspace_id = 'local'
                ) repo
         ) children FROM fingerprints WHERE fingerprints.feature_name = 'typescript-version' and fingerprints.name = 'typescript-version'
         UNION ALL
            SELECT  null as id, 'typescript-version' as name, null as sha, null as data, 'typescript-version' as type,
            (
           SELECT json_agg(row_to_json(repo))
           FROM (
                  SELECT
                    repo_snapshots.owner, repo_snapshots.name, repo_snapshots.url, 1 as size
                  FROM repo_snapshots
                   WHERE workspace_id = 'local'
                   AND repo_snapshots.id not in (select repo_fingerprints.repo_snapshot_id
                    FROM repo_fingerprints WHERE repo_fingerprints.fingerprint_id in
                        (SELECT id from fingerprints where fingerprints.feature_name = 'typescript-version'
                            AND fingerprints.name = 'typescript-version'))
                ) repo
         )
         children
) fp) as fingerprint_groups;

-- Entropy tree
SELECT row_to_json(data) FROM (SELECT f0.type, json_agg(aspects) as children FROM
(SELECT distinct feature_name as type from fingerprint_analytics) f0, (
    SELECT name, feature_name as type, variants, count, entropy
    from fingerprint_analytics f1
    WHERE ENTROPY > 0
    ORDER BY entropy desc) as aspects
    WHERE aspects.type = f0.type
    GROUP by f0.type) as data;


-- Fingerprints per repo
SELECT rs.id, owner, rs.name as repo, url, commit_sha, timestamp, jsonb_agg(f) as fingerprints
    from repo_snapshots rs, repo_fingerprints rf, fingerprints f
    where rs.id = rf.repo_snapshot_id and f.id = rf.fingerprint_id
    group by rs.id;