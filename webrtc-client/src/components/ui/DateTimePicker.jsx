// src/components/ui/DateTimePicker.jsx
import { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import PropTypes from 'prop-types';

export function DateTimePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          {format(value, 'PPpp')}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            if (date) {
              const newDate = new Date(
                Date.UTC(
                  date.getFullYear(),
                  date.getMonth(),
                  date.getDate(),
                  value.getHours(),
                  value.getMinutes()
                )
              );
              onChange(newDate);
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

DateTimePicker.propTypes = {
  value: PropTypes.instanceOf(Date).isRequired,
  onChange: PropTypes.func.isRequired,
};