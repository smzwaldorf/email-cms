/**
 * ClassManagementPage - Class management with grid view
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateMockClasses, generateMockUsers } from '@/lib/mockData';

export function ClassManagementPage() {
  const [classes] = useState(generateMockClasses());
  const [users] = useState(generateMockUsers(100));

  // Get student count for each class (mock)
  const getStudentCount = (classId: string) => {
    const gradeYear = parseInt(classId.substring(1));
    return Math.floor(Math.random() * 10) + 15; // 15-25 students
  };

  // Get teacher for each class (mock)
  const getTeacher = (classId: string) => {
    const teachers = users.filter(u => u.role === 'teacher');
    return teachers[Math.floor(Math.random() * teachers.length)]?.email.split('@')[0] || 'Unassigned';
  };

  // Group classes by grade
  const classesByGrade = classes.reduce((acc, cls) => {
    const grade = cls.class_grade_year;
    if (!acc[grade]) {
      acc[grade] = [];
    }
    acc[grade].push(cls);
    return acc;
  }, {} as Record<number, typeof classes>);

  const totalStudents = Object.keys(classesByGrade).reduce((sum, grade) => {
    return sum + classesByGrade[parseInt(grade)].reduce((gSum) => gSum + getStudentCount(''), 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-waldorf-brown">Class Management</h2>
          <p className="text-waldorf-clay mt-2">Manage classes, students, and teacher assignments</p>
        </div>
        <Button>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Create Class
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
            <span className="text-2xl">🏫</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classes.length}</div>
            <p className="text-xs text-waldorf-clay mt-1">Across 6 grades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <span className="text-2xl">👶</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-waldorf-clay mt-1">Enrolled students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teachers</CardTitle>
            <span className="text-2xl">👨‍🏫</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'teacher').length}</div>
            <p className="text-xs text-waldorf-clay mt-1">Active teachers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Class Size</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(totalStudents / classes.length)}</div>
            <p className="text-xs text-waldorf-clay mt-1">Students per class</p>
          </CardContent>
        </Card>
      </div>

      {/* Classes by Grade */}
      {Object.keys(classesByGrade).sort((a, b) => parseInt(a) - parseInt(b)).map((grade) => (
        <Card key={grade}>
          <CardHeader>
            <CardTitle>Grade {grade}</CardTitle>
            <CardDescription>{classesByGrade[parseInt(grade)].length} classes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {classesByGrade[parseInt(grade)].map((cls) => {
                const studentCount = getStudentCount(cls.id);
                const teacher = getTeacher(cls.id);

                return (
                  <Card key={cls.id} className="bg-gradient-to-br from-white to-waldorf-cream/30">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{cls.class_name}</CardTitle>
                          <CardDescription>Class {cls.id}</CardDescription>
                        </div>
                        <Badge variant="outline">{cls.id}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">👶</span>
                        <div>
                          <p className="text-sm font-medium text-waldorf-brown">{studentCount} Students</p>
                          <p className="text-xs text-waldorf-clay">Enrolled</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">👨‍🏫</span>
                        <div>
                          <p className="text-sm font-medium text-waldorf-brown">{teacher}</p>
                          <p className="text-xs text-waldorf-clay">Class Teacher</p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          View Students
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1">
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
