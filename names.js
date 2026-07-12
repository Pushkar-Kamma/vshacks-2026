const Names = (function () {
  const adjectives = [
    "Golden", "Neon", "Sunny", "Cosmic", "Velvet", "Electric",
    "Mellow", "Swift", "Lunar", "Coral", "Turbo", "Jolly",
  ];
  const animals = [
    "Otter", "Panda", "Fox", "Heron", "Lynx", "Koala",
    "Falcon", "Dolphin", "Bison", "Wren", "Tiger", "Seal",
  ];
  const colors = [
    "#2E9BF5", "#F5563B", "#22C55E", "#F59E0B",
    "#A855F7", "#EC4899", "#14B8A6", "#EAB308",
  ];

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function randomName() {
    return pick(adjectives) + " " + pick(animals);
  }

  function randomColor() {
    return pick(colors);
  }

  function getIdentity() {
    const saved = localStorage.getItem("candid_identity");
    if (saved) {
      return JSON.parse(saved);
    }
    const identity = {
      id: "u_" + Math.random().toString(36).slice(2, 10),
      name: randomName(),
      color: randomColor(),
    };
    localStorage.setItem("candid_identity", JSON.stringify(identity));
    return identity;
  }

  function setName(name) {
    const current = getIdentity();
    const next = { id: current.id, name: name, color: current.color };
    localStorage.setItem("candid_identity", JSON.stringify(next));
    return next;
  }

  const vibes = [
    "Golden Hour", "Sunset Session", "Rooftop Night", "Beach Day",
    "Road Trip", "Backyard Hang", "Night Out", "Birthday Bash",
    "Game Night", "Picnic", "Reunion", "Adventure",
  ];
  function randomRoomName() {
    return vibes[Math.floor(Math.random() * vibes.length)];
  }

  return {
    getIdentity: getIdentity,
    randomName: randomName,
    randomColor: randomColor,
    setName: setName,
    randomRoomName: randomRoomName,
  };
})();
