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
    },
    {
      tableName: "brc_user_g",
    }
  );

  return User;
};

module.exports = User;