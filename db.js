require("dotenv").config();
const { Sequelize } = require("sequelize");
const UserModel = require("./models/User");

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
  }
);

const User = UserModel(sequelize);

sequelize.sync();

module.exports = { User };
