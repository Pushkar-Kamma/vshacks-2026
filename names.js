// names.js — friendly random identities so nobody has to sign up.
// Each device gets a name + color the first time; both can be changed and are saved.

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

  // Get this device's identity, creating and saving one on first use.
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

  // Change the display name and save it.
  function setName(newName) {
    const identity = getIdentity();
    identity.name = newName;
    localStorage.setItem("candid_identity", JSON.stringify(identity));
    return identity;
  }

  return {
    getIdentity: getIdentity,
    setName: setName,
    randomName: randomName,
    randomColor: randomColor,
  };
})();
