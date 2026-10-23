import React from "react";
import FlightPanel from "./FlightPanel";

/**
 * BaseCard �?" shared Flight Deck panel for dashboard and settings sections.
 * Titles, descriptions, icons and the optional menu live in the instrument
 * rail; the children render in the panel body.
 */
const BaseCard = ({
  icon,
  title,
  description,
  menu,
  eyebrow,
  className = "",
  bodyClassName = "",
  children,
  compact = false,
  centerTitle = false,
}) => {
  return (
    <FlightPanel
      as="section"
      level="instrument"
      glass
      eyebrow={eyebrow}
      title={title}
      subtitle={description}
      icon={icon}
      actions={menu}
      flush={compact}
      className={className}
      bodyClassName={bodyClassName}
    >
      {centerTitle ? <div className="text-center">{children}</div> : children}
    </FlightPanel>
  );
};

export default BaseCard;
