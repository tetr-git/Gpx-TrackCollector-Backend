require("dotenv").config();
const { DataTypes } = require("sequelize");

const User = (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      passwordHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      folderHash: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: process.env.DB_TABLE_NAME,
    }
  );

  return User;
};

module.exports = User;
