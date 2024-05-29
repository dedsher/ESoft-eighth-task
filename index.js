const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs").promises; // Используем промисы
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 3000;
const USERS_FILE = path.join(__dirname, "users.json");

app.use(bodyParser.json());

app.use((err, req, res, next) => {
  res.status(500).json({ error: "Server error"});
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
    return res.status(404).json({ error: "No users found"});
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
    res.status(404).json({ error: "User not found"});
  }
});

// Добавление пользователя
app.post("/users", async (req, res) => {
  const usersFromRequest = req.body;

  if (!Array.isArray(usersFromRequest)) {
    return res.status(400).json({ error: "Invalid user data" })
  }

  const usersToAdd = usersFromRequest.map(user => {
    const { name, email, age } = user;

    if (name && email && age) {
      const id = uuidv4();
      return { id, name, email, age };
    } else {
      res.status(400).json({ error: "Invalid user data" });
    }
  });

  const usersToUpdate = [...users, ...usersToAdd];

  try {
    await writeUsersToFile(usersToUpdate);
    // Возвращаем добавленных пользователей для удобства отладки
    // Могли сделать так res.status(204).json({ message: "Success" })
    res.status(201).json(usersToAdd);
  } catch (err) {
    res.status(502).json({ error: "Error writing users"});
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
      res.status(200).json(user);
    } catch (err) {
      res.status(502).json({ error: "Error writing users"});
    }
  } else {
    res.status(404).json({ error: "User not found"});
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
      res.status(200).json(user);
    } catch (err) {
      res.status(502).json({ error: "Error writing users"});
    }
  } else {
    res.status(404).json({ error: "User not found"});
  }
});

// Поиск пользователей по возрасту
app.get("/users/age/:age", (req, res) => {
  const parsedAge = parseInt(req.params.age, 10);
  const filteredUsers = users.filter((user) => user.age > parsedAge);
  res.status(200).json(filteredUsers);
});

// Поиск пользователей по домену
app.get("/users/domain/:domain", (req, res) => {
  const filteredUsers = users.filter((user) =>
    user.email.endsWith(req.params.domain)
  );
  res.status(200).json(filteredUsers);
});

app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});
