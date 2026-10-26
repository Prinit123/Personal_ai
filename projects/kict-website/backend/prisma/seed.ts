import { PrismaClient, Role, AvailabilityStatus, ResourceType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Database Seeding...');

  // Clean existing tables
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.studyMaterial.deleteMany();
  await prisma.studentAvailability.deleteMany();
  await prisma.teacherAvailabilityLog.deleteMany();
  await prisma.timetableEntry.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.teacherProfile.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.semester.deleteMany();
  await prisma.course.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('GTUAdmin@2024', 10);

  // 1. Create Admin User
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@gtucollege.ac.in',
      password: hashedPassword,
      fullName: 'System Administrator (GTU)',
      role: Role.ADMIN,
    },
  });

  // 2. Create Departments
  const deptCE = await prisma.department.create({
    data: {
      code: 'CE',
      name: 'Computer Engineering',
      description: 'Department of Computer Engineering',
    },
  });

  const deptIT = await prisma.department.create({
    data: {
      code: 'IT',
      name: 'Information Technology',
      description: 'Department of Information Technology',
    },
  });

  // 3. Create Course
  const courseCE = await prisma.course.create({
    data: {
      code: 'BE_CE',
      title: 'Bachelor of Engineering in Computer Engineering',
      degree: 'B.E.',
      departmentId: deptCE.id,
    },
  });

  // 4. Create GTU Semester 7
  const sem7 = await prisma.semester.create({
    data: {
      number: 7,
      schemeYear: '2021-22',
      courseId: courseCE.id,
    },
  });

  // 5. Create Authentic GTU Sem 7 Subjects
  const cdSubject = await prisma.subject.create({
    data: {
      code: '3170701',
      name: 'Compiler Design',
      shortName: 'CD',
      semesterId: sem7.id,
    },
  });

  const isSubject = await prisma.subject.create({
    data: {
      code: '3170709',
      name: 'Information Security',
      shortName: 'IS',
      semesterId: sem7.id,
    },
  });

  const aiSubject = await prisma.subject.create({
    data: {
      code: '3170710',
      name: 'Artificial Intelligence',
      shortName: 'AI',
      semesterId: sem7.id,
    },
  });

  // 6. Create Classrooms
  const room101 = await prisma.classroom.create({
    data: { roomNo: 'LH-101', building: 'Main Block', capacity: 60, isLab: false },
  });

  const lab3 = await prisma.classroom.create({
    data: { roomNo: 'LAB-03', building: 'IT Block', capacity: 30, isLab: true },
  });

  // 7. Create Teacher
  const teacherUser = await prisma.user.create({
    data: {
      email: 'prof.sharma@gtucollege.ac.in',
      password: hashedPassword,
      fullName: 'Prof. Rajesh Sharma',
      role: Role.TEACHER,
    },
  });

  const teacherProfile = await prisma.teacherProfile.create({
    data: {
      userId: teacherUser.id,
      employeeId: 'EMP_CE_101',
      designation: 'Associate Professor',
      departmentId: deptCE.id,
      officeLocation: 'Block A, Office 204',
      officeHours: 'Mon-Thu 2:00 PM - 4:00 PM',
      currentStatus: AvailabilityStatus.AVAILABLE,
      customNote: 'In office for project discussion',
    },
  });

  // 8. Create Student
  const studentUser = await prisma.user.create({
    data: {
      email: 'student.nilesh@gtucollege.ac.in',
      password: hashedPassword,
      fullName: 'Nilesh Patel',
      role: Role.STUDENT,
    },
  });

  await prisma.studentProfile.create({
    data: {
      userId: studentUser.id,
      enrollmentNo: '210280107001',
      division: 'A',
      batch: 'A1',
      courseId: courseCE.id,
      semesterId: sem7.id,
    },
  });

  // 9. Add Timetable Entry
  await prisma.timetableEntry.create({
    data: {
      dayOfWeek: 1, // Monday
      startTime: '10:30',
      endTime: '11:30',
      division: 'A',
      subjectId: cdSubject.id,
      teacherId: teacherProfile.id,
      classroomId: room101.id,
    },
  });

  // 10. Add Verified GTU Study Materials
  await prisma.studyMaterial.createMany({
    data: [
      {
        title: 'GTU Compiler Design Syllabus & Teaching Scheme',
        description: 'Official GTU Semester 7 CD Syllabus Document',
        type: ResourceType.SYLLABUS,
        fileUrl: 'https://gtu.ac.in/syll/3170701.pdf',
        fileFormat: 'pdf',
        academicYear: '2023-24',
        subjectId: cdSubject.id,
        uploadedById: teacherProfile.id,
      },
      {
        title: 'Compiler Design Winter 2023 GTU Paper',
        description: 'Verified GTU Winter 2023 Exam Paper with Solutions',
        type: ResourceType.PREVIOUS_PAPER,
        fileUrl: 'https://gtu.ac.in/papers/W2023_3170701.pdf',
        fileFormat: 'pdf',
        academicYear: '2023-24',
        subjectId: cdSubject.id,
        uploadedById: teacherProfile.id,
      },
      {
        title: 'Lexical Analysis Unit 1 Detailed Notes',
        description: 'Comprehensive notes covering DFA, NFA, and Flex tool',
        type: ResourceType.NOTES,
        fileUrl: 'https://gtucollege.ac.in/notes/cd_unit1.pdf',
        fileFormat: 'pdf',
        academicYear: '2023-24',
        subjectId: cdSubject.id,
        uploadedById: teacherProfile.id,
      },
    ],
  });

  console.log('✅ Database Seeding Completed Successfully!');
  console.log('------------------------------------------------');
  console.log('Admin Account: admin@gtucollege.ac.in / GTUAdmin@2024');
  console.log('Teacher Account: prof.sharma@gtucollege.ac.in / GTUAdmin@2024');
  console.log('Student Account: student.nilesh@gtucollege.ac.in / GTUAdmin@2024');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
