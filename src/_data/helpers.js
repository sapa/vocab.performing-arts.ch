module.exports = {
  currentDate() {
    const today = new Date();
    return today.toLocaleDateString();
  }
};