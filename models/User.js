const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    email: { type: DataTypes.STRING, unique: true },
    password_hash: DataTypes.STRING
  }, { tableName: 'users' });

  User.prototype.checkPassword = function (pw) {
    return bcrypt.compareSync(pw, this.password_hash);
  };

  return User;
};
