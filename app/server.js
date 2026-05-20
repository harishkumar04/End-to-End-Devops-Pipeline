require("dotenv").config();

const express = require("express");
const pool = require("./db");

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "UP"
  });
});

app.get("/tasks", async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT * FROM tasks ORDER BY id"
    );

    res.json(result.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Database error"
    });
  }
});

app.post("/tasks", async (req, res) => {

  try {

    const { title } = req.body;

    await pool.query(
      "INSERT INTO tasks(title) VALUES($1)",
      [title]
    );

    res.json({
      message: "Task created"
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Database error"
    });
  }
});

app.delete("/tasks/:id", async (req, res) => {

  try {

    const { id } = req.params;

    await pool.query(
      "DELETE FROM tasks WHERE id=$1",
      [id]
    );

    res.json({
      message: "Task deleted"
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Database error"
    });
  }
});

const client = require("prom-client");

client.collectDefaultMetrics();

const register = client.register;

app.get("/metrics", async (req, res) => {

  res.set("Content-Type", register.contentType);

  res.end(await register.metrics());
});

app.listen(process.env.PORT, () => {

  console.log(
    `Server running on port ${process.env.PORT}`
  );
});
