export const formatTime12Hour = (time24) => {
  if (!time24) return "";
  
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
};
