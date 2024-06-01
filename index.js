const express = require("express");
const path = require("path");
const fs = require("fs").promises; // Используем промисы
const { v4: uuidv4 } = require("uuid");
const { HTTP_CODES, HTTP_MESSAGES } = require("./constants");

const app = express();
const PORT = 3000;
const USERS_FILE = path.join(__dirname, "users.json");

app.use(express.json());

app.use((err, req, res, next) => {
  res
    .status(HTTP_CODES.SERVER_ERROR)
    .json({ error: HTTP_MESSAGES.SERVER_ERROR });
});

// ------------------------------
// Работа с файлами и загрузка данных
// ------------------------------

const readUsersFromFile = async () => {
  try {
    const data = await fs.readFile(USERS_FILE, { encoding: "utf8" });
    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      return [];
    } else {
      throw err;
    }
  }
};

const writeUsersToFile = async (users) => {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    throw new Error("Error writing users");
  }
};

let users = [];

const loadUsers = async () => {
  try {
    users = await readUsersFromFile();
  } catch (err) {
    console.error("Error reading users", err);
  }
};

loadUsers();

// ------------------------------
// Роуты
// ------------------------------

// Получение списка пользователей
app.get("/users", (req, res) => {
  res.json(users);
});

// Получение отсортированного в алфавитном порядке списка пользователей
app.get("/users/sorted", (req, res) => {
  if (users.length === 0) {
    return res
      .status(HTTP_CODES.NOT_FOUND)
      .json({ error: HTTP_MESSAGES.USER_NOT_FOUND });
  }

  const sortedUsers = users.slice().sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  res.json(sortedUsers);
});

// Получение пользователя по id
app.get("/users/:id", (req, res) => {
  const user = users.find((user) => String(user.id) === req.params.id);
  if (user) {
    res.json(user);
  } else {
    res
      .status(HTTP_CODES.NOT_FOUND)
      .json({ error: HTTP_MESSAGES.USER_NOT_FOUND });
  }
});

// Добавление пользователя
app.post("/users", async (req, res) => {
  const usersFromRequest = req.body;

  if (!Array.isArray(usersFromRequest)) {
    return res
      .status(HTTP_CODES.BAD_REQUEST)
      .json({ error: HTTP_MESSAGES.INVALID_USER_DATA });
  }

  const usersToAdd = usersFromRequest.map((user) => {
    const { name, email, age } = user;

    if (name && email && age) {
      const id = uuidv4();
      return { id, name, email, age };
    }

    return null;
  });

  if (usersToAdd.includes(null)) {
    return res
      .status(HTTP_CODES.BAD_REQUEST)
      .json({ error: HTTP_MESSAGES.INVALID_USER_DATA });
  }

  const usersToUpdate = [...users, ...usersToAdd];

  try {
    await writeUsersToFile(usersToUpdate);
    // Возвращаем добавленных пользователей для удобства отладки
    // Могли сделать так res.status(204).json({ message: "Success" })
    res.status(HTTP_CODES.CREATED).json(usersToAdd);
  } catch (err) {
    res
      .status(HTTP_CODES.SERVER_ERROR)
      .json({ error: HTTP_MESSAGES.ERROR_WRITING_USERS });
  }
});

// Обновление пользователя
app.put("/users/:id", async (req, res) => {
  const user = users.find((user) => String(user.id) === req.params.id);
  if (user) {
    const { name, email, age } = req.body;
    if (name) user.name = name;
    if (email) user.email = email;
    if (age) user.age = age;

    try {
      await writeUsersToFile(users);
      res.status(HTTP_CODES.OK).json(user);
    } catch (err) {
      res
        .status(HTTP_CODES.SERVER_ERROR)
        .json({ error: HTTP_MESSAGES.ERROR_WRITING_USERS });
    }
  } else {
    res
      .status(HTTP_CODES.NOT_FOUND)
      .json({ error: HTTP_MESSAGES.USER_NOT_FOUND });
  }
});

// Удаление пользователя
app.delete("/users/:id", async (req, res) => {
  const userIndex = users.findIndex(
    (user) => String(user.id) === req.params.id
  );

  if (userIndex !== -1) {
    const user = users.splice(userIndex, 1)[0];

    try {
      await writeUsersToFile(users);
      res.status(HTTP_CODES.OK).json(user);
    } catch (err) {
      res
        .status(HTTP_CODES.SERVER_ERROR)
        .json({ error: HTTP_MESSAGES.ERROR_WRITING_USERS });
    }
  } else {
    res
      .status(HTTP_CODES.NOT_FOUND)
      .json({ error: HTTP_MESSAGES.USER_NOT_FOUND });
  }
});

// Поиск пользователей по возрасту
app.get("/users/age/:age", (req, res) => {
  const parsedAge = parseInt(req.params.age, 10);
  const filteredUsers = users.filter((user) => user.age > parsedAge);
  res.status(HTTP_CODES.OK).json(filteredUsers);
});

// Поиск пользователей по домену
app.get("/users/domain/:domain", (req, res) => {
  const filteredUsers = users.filter((user) =>
    user.email.endsWith(req.params.domain)
  );
  res.status(HTTP_CODES.OK).json(filteredUsers);
});

app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});
