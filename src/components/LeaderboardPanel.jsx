import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GameContext } from "../context/GameContext.jsx";
import {
  fetchLeaderboard,
  submitLeaderboardEntry,
} from "../services/apiClient.js";
import "../styles/leaderboard.css";

const DIFFICULTY_LABELS = {
  beginner: "初级",
  intermediate: "中级",
  expert: "高级",
  custom: "自定义",
};

const MAX_LEADERBOARD_ROWS = 10;
const USERNAME_STORAGE_KEY = "clearbomb-username";
const USERNAME_LOCK_STORAGE_KEY = "clearbomb-username-locked";

const formatTimestamp = (value) => {
  if (!value) {
    return "";
  }
  const candidate = new Date(value);
  if (Number.isNaN(candidate.getTime())) {
    return value.replace("T", " ").slice(0, 19);
  }
  return candidate.toLocaleString();
};

const readStoredUsername = () => {
  try {
    return localStorage.getItem(USERNAME_STORAGE_KEY) ?? "";
  } catch (error) {
    return "";
  }
};

const readStoredLockFlag = () => {
  try {
    return localStorage.getItem(USERNAME_LOCK_STORAGE_KEY) === "locked";
  } catch (error) {
    return false;
  }
};

const normaliseErrorMessage = (rawMessage, fallback) => {
  if (!rawMessage) {
    return fallback;
  }

  if (typeof rawMessage !== "string") {
    return rawMessage;
  }

  try {
    const parsed = JSON.parse(rawMessage);
    if (parsed && typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch (parseError) {
    // Ignore JSON parsing issues.
  }

  return rawMessage;
};

const LeaderboardPanel = () => {
  const { state } = useContext(GameContext);
  const [username, setUsername] = useState(() => readStoredUsername());
  const [isLocked, setIsLocked] = useState(() => {
    const stored = readStoredUsername();
    if (!stored.trim()) {
      return false;
    }
    return readStoredLockFlag();
  });
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const lastSubmissionRef = useRef(null);

  const difficulty = state.difficulty;
  const difficultyLabel =
    DIFFICULTY_LABELS[difficulty] ?? DIFFICULTY_LABELS.custom;

  const canSubmitScores = difficulty !== "custom";
  const trimmedUsername = username.trim();

  useEffect(() => {
    try {
      if (trimmedUsername) {
        localStorage.setItem(USERNAME_STORAGE_KEY, trimmedUsername);
      } else {
        localStorage.removeItem(USERNAME_STORAGE_KEY);
      }

      if (trimmedUsername && isLocked) {
        localStorage.setItem(USERNAME_LOCK_STORAGE_KEY, "locked");
      } else {
        localStorage.removeItem(USERNAME_LOCK_STORAGE_KEY);
      }
    } catch (storageError) {
      // Ignore storage failures.
    }
  }, [trimmedUsername, isLocked]);

  useEffect(() => {
    if (!trimmedUsername && isLocked) {
      setIsLocked(false);
    }
  }, [trimmedUsername, isLocked]);

  useEffect(() => {
    // 保留 lastSubmissionRef 直到新一局开始或状态离开胜利，
    // 避免在胜利后通过解锁/再次确认重复提交成绩。
  }, [isLocked]);

  const loadEntries = useCallback(async () => {
    if (!canSubmitScores) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const leaderboard = await fetchLeaderboard(
        difficulty,
        MAX_LEADERBOARD_ROWS
      );
      if (Array.isArray(leaderboard?.entries)) {
        setEntries(leaderboard.entries);
      } else {
        setEntries([]);
      }
    } catch (requestError) {
      setError(normaliseErrorMessage(requestError.message, "无法加载排行榜"));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [difficulty, canSubmitScores]);

  useEffect(() => {
    setStatusMessage("");
    lastSubmissionRef.current = null;
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (state.status !== "victory") {
      if (state.status === "playing") {
        setStatusMessage("");
      }
      if (state.status !== "victory") {
        lastSubmissionRef.current = null;
      }
      return;
    }

    if (!canSubmitScores) {
      lastSubmissionRef.current = null;
      return;
    }

    if ((state.elapsedMs ?? state.elapsedSeconds * 1000) <= 0) {
      return;
    }

    const preciseSeconds = Math.round(((state.elapsedMs ?? state.elapsedSeconds * 1000) / 1000) * 100) / 100;
    const submissionSignature = `${difficulty}-${state.rows}-${state.columns}-${state.mines}-${preciseSeconds.toFixed(2)}`;
    // 若该对局已提交过，始终显示“成绩已提交！”直至下一把
    if (lastSubmissionRef.current === submissionSignature) {
      setStatusMessage("成绩已提交！");
      return;
    }

    if (!trimmedUsername) {
      setStatusMessage("输入并确认用户名后即可在胜利时提交成绩。");
      return;
    }

    if (!isLocked) {
      setStatusMessage("确认用户名后才能提交成绩。");
      return;
    }
    lastSubmissionRef.current = submissionSignature;

    let cancelled = false;

    const submitScore = async () => {
      try {
        setStatusMessage("正在提交成绩…");
        await submitLeaderboardEntry({
          username: trimmedUsername,
          difficulty,
          timeSeconds: preciseSeconds,
        });
        if (cancelled) {
          return;
        }
        setStatusMessage("成绩已提交！");
        await loadEntries();
      } catch (submitError) {
        if (cancelled) {
          return;
        }
        setStatusMessage(
          normaliseErrorMessage(submitError.message, "提交成绩失败")
        );
        lastSubmissionRef.current = null;
      }
    };

    submitScore();

    return () => {
      cancelled = true;
    };
  }, [
    canSubmitScores,
    difficulty,
    trimmedUsername,
    isLocked,
    state.status,
    state.elapsedSeconds,
    state.rows,
    state.columns,
    state.mines,
    loadEntries,
  ]);

  const handleUsernameChange = (event) => {
    if (isLocked) {
      return;
    }
    setUsername(event.target.value);
  };

  const handleUsernameBlur = () => {
    if (username !== trimmedUsername) {
      setUsername(trimmedUsername);
    }
  };

  const handleLockConfirm = () => {
    if (!trimmedUsername) {
      return;
    }
    setIsLocked(true);
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  const emptyStateMessage = useMemo(() => {
    if (!canSubmitScores) {
      return "自定义难度暂不提供排行榜。";
    }
    if (loading) {
      return "排行榜加载中…";
    }
    if (error) {
      return error;
    }
    if (!entries.length) {
      return "暂时没有玩家记录。成为第一个吧！";
    }
    return "";
  }, [canSubmitScores, loading, error, entries.length]);

  return (
    <section
      className="leaderboard-panel"
      aria-labelledby="leaderboard-heading"
    >
      <div className="leaderboard-panel__header">
        <h2 id="leaderboard-heading">排行榜</h2>
        <span className="leaderboard-panel__difficulty">{difficultyLabel}</span>
      </div>
      <div className="leaderboard-panel__controls">
        <label
          className="leaderboard-panel__label"
          htmlFor="leaderboard-username"
        >
          用户名称
        </label>
        <div className="leaderboard-panel__input-row">
          <input
            id="leaderboard-username"
            type="text"
            maxLength={64}
            placeholder="输入用于排行榜的名称"
            value={username}
            onChange={handleUsernameChange}
            onBlur={handleUsernameBlur}
            disabled={isLocked}
          />
          {!isLocked ? (
            <button
              type="button"
              onClick={handleLockConfirm}
              disabled={!trimmedUsername}
            >
              确认用户名
            </button>
          ) : (
            <button type="button" onClick={handleUnlock}>
              取消锁定
            </button>
          )}
        </div>
      </div>
      {canSubmitScores && (
        <p className="leaderboard-panel__note">
          {!trimmedUsername
            ? "填写用户名后即可参与排行榜。"
            : !isLocked
            ? "确认用户名后才能提交成绩。"
            : "用户名已锁定，胜利时会自动提交成绩。"}
        </p>
      )}
      {statusMessage && (
        <p className="leaderboard-panel__status">{statusMessage}</p>
      )}
      {!emptyStateMessage && (
        <ol className="leaderboard-panel__list">
          {entries.map((entry, index) => (
            <li
              className="leaderboard-panel__item"
              key={`${entry.username}-${entry.recordedAt}-${entry.timeSeconds}`}
            >
              <span className="leaderboard-panel__rank">{index + 1}</span>
              <span className="leaderboard-panel__name">{entry.username}</span>
              <span className="leaderboard-panel__time">
                {Number(entry.timeSeconds).toFixed(2)}s
              </span>
              <span className="leaderboard-panel__date">
                {formatTimestamp(entry.recordedAt)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {emptyStateMessage && (
        <p className="leaderboard-panel__hint">{emptyStateMessage}</p>
      )}
    </section>
  );
};

export default LeaderboardPanel;
