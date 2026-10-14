class Player {
  constructor({ x, y, score, id }) {
    this.x = x;
    this.y = y;
    this.score = score;
    this.id = id;
    this.speed = 5; // Karakterin hareket hızı
  }

  moveDir(dir) {
    if (dir === "up") this.y -= this.speed;
    if (dir === "down") this.y += this.speed;
    if (dir === "left") this.x -= this.speed;
    if (dir === "right") this.x += this.speed;
  }

  collision(item) {
    // Basit bir 2D çarpışma tespiti (oyuncu ile toplanabilir nesne)
    if (
      this.x < item.x + item.value && // Genişliği value ile temsil edebiliriz
      this.x + 20 > item.x && // 20px oyuncu genişliği
      this.y < item.y + item.value && // Yüksekliği value ile temsil edebiliriz
      this.y + 20 > item.y // 20px oyuncu yüksekliği
    ) {
      return true;
    }
    return false;
  }

  calculateRank(arr) {
    // Puanlara göre sıralama yapıp oyuncunun sırasını bul
    const sortedScores = arr.sort((a, b) => b.score - a.score);
    const rank = sortedScores.findIndex((p) => p.id === this.id) + 1;
    return `Rank: ${rank}/${arr.length}`;
  }
}

export default Player;
