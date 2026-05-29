import React, { useState, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * HextaUI Accordion Component
 * Copy-paste component inspired by hextaui.com
 * 
 * Features:
 * - Smooth framer-motion animations
 * - Multiple/single item expansion modes
 * - Customizable styling via className
 * - Accessible keyboard navigation
 * - Clean, modern design
 */

// Context for accordion state
const AccordionContext = createContext(null);

const useAccordion = () => {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion items must be wrapped in <Accordion />");
  }
  return context;
};

/**
 * Main Accordion Container
 * @param {Object} props
 * @param {React.ReactNode} props.children - Accordion items
 * @param {string} [props.className] - Additional classes
 * @param {string} [props.type="single"] - "single" or "multiple" expansion mode
 * @param {string | string[]} [props.defaultValue] - Default open item value(s)
 * @param {Function} [props.onValueChange] - Callback when value changes
 * @param {boolean} [props.collapsible=true] - Allow closing all items in single mode
 */
export function Accordion({
  children,
  className,
  type = "single",
  defaultValue,
  onValueChange,
  collapsible = true,
}) {
  const [value, setValue] = useState(
    type === "multiple" 
      ? (defaultValue ? [defaultValue] : []) 
      : (defaultValue || "")
  );

  /**
 * @param {string | string[]} newValue
 */
const handleValueChange = (newValue) => {
    setValue(newValue);
    onValueChange?.(newValue);
  };

  /**
 * @param {string} itemValue
 * @returns {boolean}
 */
const isOpen = (itemValue) => {
    if (type === "multiple") {
      return value.includes(itemValue);
    }
    return value === itemValue;
  };

  /**
 * @param {string} itemValue
 */
const toggleItem = (itemValue) => {
    if (type === "multiple") {
      handleValueChange(
        isOpen(itemValue)
          ? /** @type {string[]} */ (value).filter((/** @type {string} */ v) => v !== itemValue)
          : [.../** @type {string[]} */ (value), itemValue]
      );
    } else {
      if (collapsible && value === itemValue) {
        handleValueChange("");
      } else {
        handleValueChange(itemValue);
      }
    }
  };

  return (
    <AccordionContext.Provider
      value={{ value, isOpen, toggleItem, type }}
    >
      <div className={cn("space-y-2", className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

/**
 * Accordion Item Container
 * @param {Object} props
 * @param {React.ReactNode} props.children - Trigger and Content
 * @param {string} props.value - Unique identifier for this item
 * @param {string} [props.className] - Additional classes
 */
export function AccordionItem({ children, value, className }) {
  return (
    <div
      className={cn(
        "overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Accordion Trigger/Button
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.value - Must match parent AccordionItem value
 * @param {string} [props.className] - Additional classes
 * @param {React.ReactNode} [props.icon] - Custom icon (default: ChevronDown)
 */
export function AccordionTrigger({
  children,
  value,
  className,
  icon,
}) {
  const { isOpen, toggleItem } = useAccordion();
  const open = isOpen(value);

  return (
    <button
      type="button"
      onClick={() => toggleItem(value)}
      aria-expanded={open}
      className={cn(
        "flex items-center justify-between w-full",
        "px-4 py-4 text-left",
        "bg-white dark:bg-zinc-900",
        "border border-zinc-200 dark:border-zinc-800",
        "rounded-xl",
        "transition-all duration-200 ease-out",
        "hover:bg-zinc-50 dark:hover:bg-zinc-800/80",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
        "group",
        className
      )}
    >
      <span className="flex-1 pr-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {children}
      </span>
      <motion.div
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="flex-shrink-0"
      >
        {icon || (
          <ChevronDown className="w-5 h-5 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors" />
        )}
      </motion.div>
    </button>
  );
}

/**
 * Accordion Content Panel
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to show/hide
 * @param {string} props.value - Must match parent AccordionItem value
 * @param {string} [props.className] - Additional classes
 */
export function AccordionContent({ children, value, className }) {
  const { isOpen } = useAccordion();
  const open = isOpen(value);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: { duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] },
            opacity: { duration: 0.15, ease: "easeInOut" },
          }}
          className="overflow-hidden"
        >
          <div
            className={cn(
              "px-4 py-4",
              "bg-zinc-50/50 dark:bg-zinc-800/30",
              "border-x border-b border-zinc-200 dark:border-zinc-800",
              "rounded-b-xl -mt-2 pt-6",
              "text-sm text-zinc-600 dark:text-zinc-400",
              className
            )}
          >
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Accordion;
