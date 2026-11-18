import React from "react";
import { FaArrowRight } from "react-icons/fa";

export default function AcademicClassChange({ from, to, selected = false }) {
  return <p className={`academic-class-change${selected ? " is-selected" : ""}`}>
    <span>{from}</span>
    {to && <><FaArrowRight aria-hidden="true" /><span className="sr-only">to</span><span className="academic-class-target">{to}</span></>}
  </p>;
}
